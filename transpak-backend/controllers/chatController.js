const mongoose = require("mongoose");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const chatService = require("../services/chatService");
const Conversation = require("../models/Conversation");

async function openConversation(req, res) {
  try {
    const { peerUserId, loadId } = req.body || {};
    if (!peerUserId || !mongoose.isValidObjectId(String(peerUserId))) {
      return sendError(res, 400, "peerUserId is required");
    }
    const lid = loadId && mongoose.isValidObjectId(String(loadId)) ? String(loadId) : null;
    const conv = await chatService.getOrCreateConversation(req.auth.userId, peerUserId, lid);
    return sendSuccess(res, 200, {
      conversationId: conv._id.toString(),
      loadId: conv.loadId ? String(conv.loadId) : null,
      peerUserId: String(peerUserId)
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return sendError(res, status, err.message || "Server error");
  }
}

async function listConversations(req, res) {
  try {
    const data = await chatService.listConversations(req.auth.userId);
    return sendSuccess(res, 200, data);
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

async function listMessages(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(String(id))) return sendError(res, 400, "Invalid conversation id");
    const before = req.query.before;
    const limit = req.query.limit;
    const data = await chatService.listMessages(id, req.auth.userId, { before, limit });
    return sendSuccess(res, 200, data);
  } catch (err) {
    const status = err.statusCode || 500;
    return sendError(res, status, err.message || "Server error");
  }
}

async function postMessage(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(String(id))) return sendError(res, 400, "Invalid conversation id");
    const { body, clientMessageId } = req.body || {};
    const text = String(body || "").trim();
    if (!text) return sendError(res, 400, "body is required");

    const conv = await Conversation.findById(id);
    if (!conv) return sendError(res, 404, "Not found");
    await chatService.assertParticipant(id, req.auth.userId);

    const peer = conv.participants.map(String).find((u) => u !== String(req.auth.userId));
    if (!peer) return sendError(res, 400, "Invalid conversation");

    const loadId = conv.loadId ? String(conv.loadId) : null;
    const msg = await chatService.sendMessage({
      senderId: req.auth.userId,
      peerUserId: peer,
      loadId,
      text,
      clientMessageId,
      io: null
    });
    return sendSuccess(res, 201, msg, "Created");
  } catch (err) {
    const status = err.statusCode || 500;
    return sendError(res, status, err.message || "Server error");
  }
}

async function markRead(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(String(id))) return sendError(res, 400, "Invalid conversation id");
    const { upToMessageId } = req.body || {};
    const data = await chatService.markConversationRead(id, req.auth.userId, upToMessageId || null);
    return sendSuccess(res, 200, data);
  } catch (err) {
    const status = err.statusCode || 500;
    return sendError(res, status, err.message || "Server error");
  }
}

module.exports = {
  openConversation,
  listConversations,
  listMessages,
  postMessage,
  markRead
};
