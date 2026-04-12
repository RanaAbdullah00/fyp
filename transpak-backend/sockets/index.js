const { verifyToken } = require("../utils/jwt");
const chatService = require("../services/chatService");
const realtimeHub = require("../services/realtimeHub");
const logger = require("../utils/logger");
const Conversation = require("../models/Conversation");

function extractToken(socket) {
  const a = socket.handshake.auth;
  if (a && typeof a.token === "string" && a.token.trim()) return a.token.trim();
  const h = socket.handshake.headers?.authorization;
  if (typeof h === "string" && h.startsWith("Bearer ")) return h.slice(7).trim();
  return null;
}

module.exports = function registerSocketHandlers(io) {
  io.use((socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) return next(new Error("auth_required"));
      const decoded = verifyToken(token);
      socket.userId = decoded.sub;
      return next();
    } catch {
      return next(new Error("auth_required"));
    }
  });

  io.on("connection", (socket) => {
    const uid = socket.userId;
    socket.join(`user:${uid}`);

    socket.on("chat:join", async (payload, cb) => {
      try {
        const conversationId = payload?.conversationId;
        if (!conversationId) throw new Error("conversationId required");
        await chatService.assertParticipant(conversationId, uid);
        socket.join(`conv:${conversationId}`);
        if (typeof cb === "function") cb({ ok: true });
      } catch (e) {
        logger.warn("socket_chat_join_failed", { err: e.message });
        if (typeof cb === "function") cb({ ok: false, message: e.message || "join failed" });
      }
    });

    socket.on("chat:send", async (payload, cb) => {
      try {
        const { peerUserId, loadId, text, clientMessageId } = payload || {};
        const msg = await chatService.sendMessage({
          senderId: uid,
          peerUserId,
          loadId: loadId || null,
          text,
          clientMessageId
        });
        if (typeof cb === "function") cb({ ok: true, data: msg });
      } catch (e) {
        logger.warn("socket_chat_send_failed", { err: e.message });
        if (typeof cb === "function") cb({ ok: false, message: e.message || "send failed" });
      }
    });

    socket.on("chat:seen", async (payload, cb) => {
      try {
        const { conversationId, upToMessageId } = payload || {};
        if (!conversationId) throw new Error("conversationId required");
        await chatService.markConversationRead(conversationId, uid, upToMessageId || null);
        const payload = {
          conversationId: String(conversationId),
          userId: String(uid),
          upToMessageId: upToMessageId || null
        };
        const conv = await Conversation.findById(conversationId).select("participants").lean();
        const parts = conv?.participants?.map(String) || [];
        for (const pid of parts) {
          if (pid !== String(uid)) realtimeHub.emitToUser(pid, "chat:seen", payload);
        }
        if (typeof cb === "function") cb({ ok: true });
      } catch (e) {
        if (typeof cb === "function") cb({ ok: false, message: e.message || "seen failed" });
      }
    });
  });
};
