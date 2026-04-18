const express = require("express");
const { body, validationResult } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const User = require("../models/User");

const router = express.Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, errors.array()[0]?.msg || "Validation error", {
      fields: errors.array().map((e) => e.path)
    });
  }
  return next();
}

router.get("/me", protect, async (req, res) => {
  const user = await User.findById(req.auth.userId);
  if (!user) return sendError(res, 404, "Not found");
  return sendSuccess(res, 200, { user: user.toAuthJSON() });
});

router.put(
  "/me",
  protect,
  [
    body("name").optional().trim().isLength({ min: 2, max: 120 }).withMessage("Invalid name"),
    body("address").optional().trim().isLength({ max: 240 }).withMessage("Invalid address"),
    body("bio").optional().trim().isLength({ max: 500 }).withMessage("Invalid bio"),
    body("profileImage").optional().trim().isLength({ max: 250000 }).withMessage("Invalid profileImage"),
    body("cnicFrontImage").optional().trim().isLength({ max: 250000 }).withMessage("Invalid cnicFrontImage"),
    body("cnicBackImage").optional().trim().isLength({ max: 250000 }).withMessage("Invalid cnicBackImage")
  ],
  validate,
  async (req, res) => {
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

