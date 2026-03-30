const express = require("express");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const User = require("../models/User");
const Load = require("../models/Load");
const Bid = require("../models/Bid");

const router = express.Router();

router.use(protect, requireRole("admin"));

router.get("/users", async (req, res) => {
  const users = await User.find({}).sort({ createdAt: -1 }).limit(500);
  return sendSuccess(res, 200, users.map((u) => u.toAuthJSON()));
});

router.patch("/users/:id/block", async (req, res) => {
  const { blocked } = req.body || {};
  const user = await User.findById(req.params.id);
  if (!user) return sendError(res, 404, "Not found");
  user.blocked = Boolean(blocked);
  await user.save();
  return sendSuccess(res, 200, { ok: true, user: user.toAuthJSON() });
});

router.get("/loads", async (req, res) => {
  const loads = await Load.find({}).sort({ createdAt: -1 }).limit(500);
  return sendSuccess(res, 200, loads.map((l) => l.toJSONSafe()));
});

router.delete("/loads/:id", async (req, res) => {
  const load = await Load.findById(req.params.id);
  if (!load) return sendError(res, 404, "Not found");
  await Bid.deleteMany({ loadId: load._id });
  await load.deleteOne();
  return sendSuccess(res, 200, { ok: true });
});

router.get("/stats", async (req, res) => {
  const [users, loads, bids] = await Promise.all([
    User.countDocuments({}),
    Load.countDocuments({}),
    Bid.countDocuments({})
  ]);
  return sendSuccess(res, 200, {
    totalUsers: users,
    totalLoads: loads,
    totalBids: bids
  });
});

module.exports = router;
