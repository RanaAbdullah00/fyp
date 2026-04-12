const mongoose = require("mongoose");
const AppNotification = require("../models/AppNotification");
const { emitToUser } = require("./realtimeHub");
const logger = require("../utils/logger");

/**
 * Persist + push realtime notification (deduped in controller for user-created; here short window for system events).
 */
async function notifyUser(userId, { title, message, roleType = "", meta = null, dedupeMs = 60000 }) {
  const uid = mongoose.isValidObjectId(String(userId)) ? new mongoose.Types.ObjectId(String(userId)) : null;
  if (!uid) return null;

  const t = String(title || "Update").slice(0, 120);
  const m = String(message || "").slice(0, 2000);
  if (!m) return null;

  const since = new Date(Date.now() - dedupeMs);
  const dup = await AppNotification.findOne({
    userId: uid,
    title: t,
    message: m,
    createdAt: { $gte: since }
  });
  if (dup) {
    const safe = dup.toJSONSafe();
    emitToUser(uid, "notification:new", { ...safe, type: meta?.type || t });
    return safe;
  }

  const doc = await AppNotification.create({
    userId: uid,
    title: t,
    message: m,
    roleType: String(roleType || "").slice(0, 32),
    meta: meta && typeof meta === "object" ? meta : null
  });
  const safe = doc.toJSONSafe();
  try {
    emitToUser(uid, "notification:new", { ...safe, type: meta?.type || t });
  } catch (err) {
    logger.warn("notification_emit_failed", { err: err.message });
  }
  return safe;
}

module.exports = { notifyUser };
