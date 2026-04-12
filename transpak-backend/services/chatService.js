const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");
const Load = require("../models/Load");
const { emitToUser } = require("./realtimeHub");
const { notifyUser } = require("./notificationDispatch");
const logger = require("../utils/logger");

function sortParticipantIds(a, b) {
  const s1 = String(a);
  const s2 = String(b);
  return s1 < s2 ? [s1, s2] : [s2, s1];
}

function makeConversationKey(userA, userB, loadId) {
  const [x, y] = sortParticipantIds(userA, userB);
  const lid = loadId ? String(loadId) : "_";
  return `${x}:${y}:${lid}`;
}

async function assertLoadParty(loadId, userId) {
  if (!loadId || !mongoose.isValidObjectId(String(loadId))) return false;
  const load = await Load.findById(loadId).select("shipperId assignedCarrierId status");
  if (!load) return false;
  const uid = String(userId);
  if (String(load.shipperId) === uid) return true;
  if (load.assignedCarrierId && String(load.assignedCarrierId) === uid) return true;
  return false;
}

async function assertCanOpenConversation(actorId, peerId, loadId) {
  if (!mongoose.isValidObjectId(String(peerId)) || String(actorId) === String(peerId)) {
    const e = new Error("Invalid peer");
    e.statusCode = 400;
    throw e;
  }
  const peer = await User.findById(peerId).select("_id");
  if (!peer) {
    const e = new Error("Peer not found");
    e.statusCode = 404;
    throw e;
  }
  if (loadId) {
    const ok = await assertLoadParty(loadId, actorId);
    const okPeer = await assertLoadParty(loadId, peerId);
    if (!ok || !okPeer) {
      const e = new Error("Not a participant on this load");
      e.statusCode = 403;
      throw e;
    }
  }
}

async function getOrCreateConversation(actorId, peerId, loadId = null) {
  await assertCanOpenConversation(actorId, peerId, loadId);
  const key = makeConversationKey(actorId, peerId, loadId);
  const [p0, p1] = sortParticipantIds(actorId, peerId).map((id) => new mongoose.Types.ObjectId(id));

  let conv = await Conversation.findOne({ key });
  if (!conv) {
    try {
      conv = await Conversation.create({
        key,
        participants: [p0, p1],
        loadId: loadId ? new mongoose.Types.ObjectId(String(loadId)) : null
      });
    } catch (err) {
      if (err && err.code === 11000) {
        conv = await Conversation.findOne({ key });
      } else {
        throw err;
      }
    }
  }
  return conv;
}

async function assertParticipant(conversationId, userId) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    const e = new Error("Conversation not found");
    e.statusCode = 404;
    throw e;
  }
  const ok = conv.participants.some((p) => String(p) === String(userId));
  if (!ok) {
    const e = new Error("Forbidden");
    e.statusCode = 403;
    throw e;
  }
  return conv;
}

function readAtLookup(conv, userKey) {
  if (!conv?.readAt) return null;
  if (typeof conv.readAt.get === "function") return conv.readAt.get(String(userKey)) || null;
  return conv.readAt[String(userKey)] || null;
}

function messageToDTO(msg, conv, viewerId) {
  const other = conv.participants.map(String).find((id) => id !== String(msg.senderId));
  const peerLastRead = other ? readAtLookup(conv, other) : null;
  const seenByPeer = peerLastRead && msg.createdAt && new Date(peerLastRead) >= new Date(msg.createdAt);

  return {
    id: msg._id.toString(),
    conversationId: msg.conversationId.toString(),
    senderId: msg.senderId.toString(),
    body: msg.body,
    clientMessageId: msg.clientMessageId || null,
    createdAt: msg.createdAt,
    delivered: true,
    seenByPeer: Boolean(seenByPeer && String(msg.senderId) === String(viewerId))
  };
}

async function listConversations(userId) {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const list = await Conversation.find({ participants: uid })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(100)
    .lean();

  const peerIds = [];
  for (const c of list) {
    const other = c.participants.map(String).find((id) => id !== String(userId));
    if (other) peerIds.push(other);
  }
  const uniquePeers = [...new Set(peerIds)];
  const users = await User.find({ _id: { $in: uniquePeers } })
    .select("name email")
    .lean();
  const nameById = new Map(users.map((u) => [String(u._id), u.name || u.email || "User"]));

  return list.map((c) => {
    const other = c.participants.map(String).find((id) => id !== String(userId));
    const myRead = readAtLookup(c, userId);
    const peerRead = other ? readAtLookup(c, other) : null;
    return {
      id: c._id.toString(),
      peerUserId: other || null,
      peerName: other ? nameById.get(other) || "User" : "User",
      loadId: c.loadId ? String(c.loadId) : null,
      lastMessageAt: c.lastMessageAt,
      lastPreview: c.lastPreview || "",
      myLastReadAt: myRead || null,
      peerLastReadAt: peerRead || null
    };
  });
}

async function listMessages(conversationId, userId, { before = null, limit = 40 } = {}) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    const e = new Error("Not found");
    e.statusCode = 404;
    throw e;
  }
  await assertParticipant(conversationId, userId);

  const q = { conversationId: conv._id };
  if (before && mongoose.isValidObjectId(String(before))) {
    q._id = { $lt: new mongoose.Types.ObjectId(String(before)) };
  }

  const take = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const rows = await ChatMessage.find(q).sort({ _id: -1 }).limit(take).lean();

  const ordered = rows.reverse();
  return ordered.map((m) =>
    messageToDTO(
      { ...m, _id: m._id, conversationId: m.conversationId, senderId: m.senderId },
      conv,
      userId
    )
  );
}

async function sendMessage({ senderId, peerUserId, loadId, text, clientMessageId }) {
  const body = String(text || "").trim();
  if (!body) {
    const e = new Error("Message body required");
    e.statusCode = 400;
    throw e;
  }
  if (body.length > 2000) {
    const e = new Error("Message too long");
    e.statusCode = 400;
    throw e;
  }

  const conv = await getOrCreateConversation(senderId, peerUserId, loadId || null);

  const payload = {
    conversationId: conv._id,
    senderId: new mongoose.Types.ObjectId(String(senderId)),
    body,
    clientMessageId: clientMessageId ? String(clientMessageId).slice(0, 128) : null
  };

  let msg;
  try {
    msg = await ChatMessage.create(payload);
  } catch (err) {
    if (err && err.code === 11000 && payload.clientMessageId) {
      msg = await ChatMessage.findOne({
        conversationId: conv._id,
        clientMessageId: payload.clientMessageId
      });
    } else {
      throw err;
    }
  }

  const preview = body.length > 120 ? `${body.slice(0, 117)}...` : body;
  await Conversation.updateOne(
    { _id: conv._id },
    { $set: { lastMessageAt: msg.createdAt, lastPreview: preview } }
  );

  const freshConv = await Conversation.findById(conv._id);
  const dto = messageToDTO(msg, freshConv, senderId);

  const envelope = { ...dto, conversationId: String(conv._id) };
  const peer = conv.participants.map(String).find((id) => id !== String(senderId));
  if (peer) emitToUser(peer, "chat:message", envelope);
  emitToUser(senderId, "chat:message", envelope);
  if (peer) {
    notifyUser(peer, {
      title: "New message",
      message: preview,
      meta: { type: "chat", conversationId: String(conv._id) }
    }).catch((err) => logger.warn("chat_notify_failed", { err: err.message }));
  }

  return envelope;
}

async function markConversationRead(conversationId, userId, upToMessageId = null) {
  const conv = await assertParticipant(conversationId, userId);
  let at = new Date();
  if (upToMessageId && mongoose.isValidObjectId(String(upToMessageId))) {
    const m = await ChatMessage.findOne({
      _id: upToMessageId,
      conversationId: conv._id
    }).select("createdAt");
    if (m?.createdAt) at = m.createdAt;
  }
  if (!(conv.readAt instanceof Map)) {
    const raw = conv.readAt && typeof conv.readAt === "object" ? conv.readAt : {};
    conv.readAt = new Map(Object.entries(raw));
  }
  conv.readAt.set(String(userId), at);
  await conv.save();
  return { conversationId: String(conversationId), userId: String(userId), readAt: at };
}

module.exports = {
  makeConversationKey,
  getOrCreateConversation,
  assertParticipant,
  listConversations,
  listMessages,
  sendMessage,
  markConversationRead,
  assertCanOpenConversation
};
