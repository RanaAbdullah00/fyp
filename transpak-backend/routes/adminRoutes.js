const express = require("express");
const { protect, requireRole } = require("../middleware/authMiddleware");
const User = require("../models/User");
const Load = require("../models/Load");
const Bid = require("../models/Bid");

const router = express.Router();

router.use(protect, requireRole("admin"));

// GET /api/admin/users
router.get("/users", async (req, res) => {
  const users = await User.find({}).sort({ createdAt: -1 }).limit(500);
  return res.json(users.map((u) => u.toAuthJSON()));
});

// PATCH /api/admin/users/:id/block
router.patch("/users/:id/block", async (req, res) => {
  const { blocked } = req.body || {};
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  user.blocked = Boolean(blocked);
  await user.save();
  return res.json({ ok: true, user: user.toAuthJSON() });
});

// GET /api/admin/loads
router.get("/loads", async (req, res) => {
  const loads = await Load.find({}).sort({ createdAt: -1 }).limit(500);
  return res.json(loads.map((l) => l.toJSONSafe()));
});

// DELETE /api/admin/loads/:id
router.delete("/loads/:id", async (req, res) => {
  const load = await Load.findById(req.params.id);
  if (!load) return res.status(404).json({ error: "Not found" });
  await Bid.deleteMany({ loadId: load._id });
  await load.deleteOne();
  return res.json({ ok: true });
});

// GET /api/admin/stats
router.get("/stats", async (req, res) => {
  const [users, loads, bids] = await Promise.all([
    User.countDocuments({}),
    Load.countDocuments({}),
    Bid.countDocuments({})
  ]);
  return res.json({
    totalUsers: users,
    totalLoads: loads,
    totalBids: bids
  });
});

module.exports = router;

