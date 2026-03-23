const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const User = require("../models/User");

const router = express.Router();

// GET /api/users/me
router.get("/me", protect, async (req, res) => {
  const user = await User.findById(req.auth.userId);
  if (!user) return res.status(404).json({ error: "Not found" });
  return res.json({ user: user.toAuthJSON() });
});

// PUT /api/users/me
router.put("/me", protect, async (req, res) => {
  const user = await User.findById(req.auth.userId);
  if (!user) return res.status(404).json({ error: "Not found" });
  if (user.blocked) return res.status(403).json({ error: "Account is blocked" });

  const { name, address, bio, profileImage, cnicFrontImage, cnicBackImage } = req.body || {};
  if (name != null) user.name = String(name).trim();
  if (address != null) user.address = String(address).trim();
  if (bio != null) user.bio = String(bio).trim();
  if (profileImage != null) user.profileImage = String(profileImage).trim();
  if (cnicFrontImage != null) user.cnicFrontImage = String(cnicFrontImage).trim();
  if (cnicBackImage != null) user.cnicBackImage = String(cnicBackImage).trim();

  await user.save();
  return res.json({ user: user.toAuthJSON() });
});

module.exports = router;

