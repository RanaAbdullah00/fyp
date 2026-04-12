const mongoose = require("mongoose");
const Review = require("../models/Review");
const User = require("../models/User");
const Load = require("../models/Load");
const { sendSuccess, sendError } = require("../utils/apiResponse");

async function createReview(req, res) {
  try {
    const { toUser, rating, comment, loadId } = req.body || {};
    const fromId = req.auth.userId;
    const loadIdClean = loadId && String(loadId).trim() && mongoose.isValidObjectId(String(loadId).trim()) ? String(loadId).trim() : null;
    const r = Number(rating);
    if (!toUser || !mongoose.isValidObjectId(String(toUser))) {
      return sendError(res, 400, "Valid toUser id is required");
    }
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return sendError(res, 400, "Rating must be between 1 and 5");
    }
    if (String(toUser) === String(fromId)) {
      return sendError(res, 400, "Cannot review yourself");
    }

    const target = await User.findById(toUser);
    if (!target) return sendError(res, 404, "User not found");

    if (loadIdClean) {
      const load = await Load.findById(loadIdClean);
      if (!load) return sendError(res, 404, "Load not found");
      const dup = await Review.findOne({ fromUser: fromId, loadId: loadIdClean });
      if (dup) return sendError(res, 409, "You already reviewed this shipment");
    }

    const doc = await Review.create({
      fromUser: fromId,
      toUser,
      loadId: loadIdClean,
      rating: Math.round(r),
      comment: String(comment || "").trim().slice(0, 2000)
    });

    return sendSuccess(res, 201, doc.toJSONSafe(), "Review submitted");
  } catch (err) {
    if (err && err.code === 11000) {
      return sendError(res, 409, "Duplicate review for this shipment");
    }
    return sendError(res, 500, err.message || "Server error");
  }
}

async function listReviewsForUser(req, res) {
  try {
    const { userId } = req.params;
    if (!userId || !mongoose.isValidObjectId(String(userId))) {
      return sendError(res, 400, "Invalid user id");
    }
    const list = await Review.find({ toUser: userId }).sort({ createdAt: -1 }).limit(100).lean();
    const data = list.map((row) => ({
      id: row._id.toString(),
      fromUser: String(row.fromUser),
      toUser: String(row.toUser),
      loadId: row.loadId ? String(row.loadId) : null,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
    return sendSuccess(res, 200, data);
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

module.exports = { createReview, listReviewsForUser };
