const mongoose = require("mongoose");
const AppNotification = require("../models/AppNotification");
const { sendSuccess, sendError } = require("../utils/apiResponse");

async function listMine(req, res) {
  try {
    const list = await AppNotification.find({ userId: req.auth.userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const data = list.map((row) => ({
      id: row._id.toString(),
      _id: row._id.toString(),
      type: row.meta?.type || row.title || "INFO",
      message: row.message,
      title: row.title,
      roleType: row.roleType || "",
      read: row.read,
      isRead: row.read,
      createdAt: row.createdAt
    }));
    return sendSuccess(res, 200, data);
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

async function createMine(req, res) {
  try {
    const { title, message, roleType, meta } = req.body || {};
    const t = String(title || "").trim().slice(0, 120);
    const m = String(message || "").trim().slice(0, 2000);
    if (!t || !m) return sendError(res, 400, "title and message are required");

    const since = new Date(Date.now() - 120000);
    const dup = await AppNotification.findOne({
      userId: req.auth.userId,
      title: t,
      message: m,
      createdAt: { $gte: since }
    });
    if (dup) return sendSuccess(res, 200, dup.toJSONSafe(), "Already recorded");

    const doc = await AppNotification.create({
      userId: req.auth.userId,
      title: t,
      message: m,
      roleType: String(roleType || "").trim().slice(0, 32),
      meta: meta && typeof meta === "object" ? meta : null
    });
    return sendSuccess(res, 201, doc.toJSONSafe());
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

async function markRead(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(String(id))) return sendError(res, 400, "Invalid notification id");
    const doc = await AppNotification.findOne({ _id: id, userId: req.auth.userId });
    if (!doc) return sendError(res, 404, "Not found");
    doc.read = true;
    await doc.save();
    return sendSuccess(res, 200, doc.toJSONSafe());
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

async function unreadCount(req, res) {
  try {
    const n = await AppNotification.countDocuments({ userId: req.auth.userId, read: false });
    return sendSuccess(res, 200, { unreadCount: n });
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

module.exports = { listMine, createMine, markRead, unreadCount };
