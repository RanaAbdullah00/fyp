const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const User = require("../models/User");

const router = express.Router();

router.get("/me", protect, async (req, res) => {
  const user = await User.findById(req.auth.userId);
  if (!user) return sendError(res, 404, "Not found");
  return sendSuccess(res, 200, { user: user.toAuthJSON() });
});

router.put("/me", protect, async (req, res) => {
  const user = await User.findById(req.auth.userId);
  if (!user) return sendError(res, 404, "Not found");
  if (user.blocked) return sendError(res, 403, "Account is blocked");

  const { name, address, bio, profileImage, cnicFrontImage, cnicBackImage } = req.body || {};
  if (name != null) user.name = String(name).trim();
  if (address != null) user.address = String(address).trim();
  if (bio != null) user.bio = String(bio).trim();
  if (profileImage != null) user.profileImage = String(profileImage).trim();
  if (cnicFrontImage != null) user.cnicFrontImage = String(cnicFrontImage).trim();
  if (cnicBackImage != null) user.cnicBackImage = String(cnicBackImage).trim();

  await user.save();
  return sendSuccess(res, 200, { user: user.toAuthJSON() });
});

module.exports = router;

