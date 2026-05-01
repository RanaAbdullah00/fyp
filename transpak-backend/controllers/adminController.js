const mongoose = require("mongoose");
const { body, param } = require("express-validator");
const User = require("../models/User");
const Load = require("../models/Load");
const Bid = require("../models/Bid");
const Review = require("../models/Review");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const patchUserRoleValidators = [
  param("id").isMongoId().withMessage("Invalid user id"),
  body("roles")
    .isArray({ min: 1 })
    .withMessage("roles must be a non-empty array")
    .custom((arr) => {
      const allowed = User.ALLOWED_ROLES || ["shipper", "carrier", "admin"];
      if (!Array.isArray(arr) || !arr.every((r) => allowed.includes(String(r)))) {
        throw new Error("Invalid role in roles array");
      }
      return true;
    }),
  body("activeRole")
    .trim()
    .isIn(User.ALLOWED_ROLES || ["shipper", "carrier", "admin"])
    .withMessage("activeRole must be shipper, carrier, or admin")
];

async function getStats(req, res) {
  try {
    const [totalUsers, totalLoads, totalBids, activeShipments, totalReviews, totalBookings] = await Promise.all([
      User.countDocuments({}),
      Load.countDocuments({}),
      Bid.countDocuments({}),
      Load.countDocuments({ status: { $in: ["assigned", "in_transit"] } }),
      Review.countDocuments({}),
      Load.countDocuments({ status: { $in: ["assigned", "in_transit", "delivered"] } })
    ]);
    return sendSuccess(res, 200, {
      totalUsers,
      totalLoads,
      totalShipments: totalLoads,
      totalBookings,
      activeShipments,
      totalBids: totalBids,
      totalReviews: totalReviews
    });
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

async function getUsers(req, res) {
  try {
    const users = await User.find({}).sort({ createdAt: -1 }).limit(500);
    return sendSuccess(res, 200, users.map((u) => u.toAuthJSON()));
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

async function getLoads(req, res) {
  try {
    const loads = await Load.find({}).sort({ createdAt: -1 }).limit(500);
    return sendSuccess(res, 200, loads.map((l) => l.toJSONSafe()));
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

async function deleteUser(req, res) {
  try {
    const targetId = req.params.id;
    if (String(targetId) === String(req.auth.userId)) {
      return sendError(res, 403, "Cannot delete your own account");
    }

    const user = await User.findById(targetId);
    if (!user) return sendError(res, 404, "Not found");

    if (Array.isArray(user.roles) && user.roles.includes("admin")) {
      return sendError(res, 403, "Cannot delete an admin account");
    }

    const oid = new mongoose.Types.ObjectId(String(targetId));
    const [loadRefs, bidRefs] = await Promise.all([
      Load.countDocuments({ $or: [{ shipperId: oid }, { assignedCarrierId: oid }] }),
      Bid.countDocuments({ carrierId: oid })
    ]);

    if (loadRefs > 0 || bidRefs > 0) {
      return sendError(
        res,
        409,
        "User has related loads or bids. Remove or reassign them before deleting this account."
      );
    }

    await user.deleteOne();
    return sendSuccess(res, 200, { ok: true }, "User deleted");
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

async function patchUserRole(req, res) {
  try {
    const targetId = req.params.id;
    const { roles, activeRole } = req.body || {};
    const nextRoles = Array.isArray(roles) ? roles.map((r) => String(r).trim()) : [];
    const nextActive = String(activeRole || "").trim();

    if (!nextRoles.includes(nextActive)) {
      return sendError(res, 400, "activeRole must be one of the roles provided");
    }

    const user = await User.findById(targetId);
    if (!user) return sendError(res, 404, "Not found");

    const hadAdmin = Array.isArray(user.roles) && user.roles.includes("admin");
    const willHaveAdmin = nextRoles.includes("admin");

    if (hadAdmin && !willHaveAdmin) {
      const adminCount = await User.countDocuments({ roles: "admin" });
      if (adminCount <= 1) {
        return sendError(res, 409, "Cannot remove the last admin from the system");
      }
    }

    user.roles = [...new Set(nextRoles)];
    user.activeRole = nextActive;
    await user.save();

    return sendSuccess(res, 200, { ok: true, user: user.toAuthJSON() }, "Updated");
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

module.exports = {
  getStats,
  getUsers,
  getLoads,
  deleteUser,
  patchUserRole,
  patchUserRoleValidators
};
