const express = require("express");
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");
const { register, login, profile, updateActiveRole } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const User = require("../models/User");

const router = express.Router();

const allowedRoles = User.ALLOWED_ROLES || ["shipper", "carrier", "admin"];

// Basic brute-force protection for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts, please try again later",
    data: null
  }
});

router.post(
  "/register",
  [
    body("name").trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
    body("email").trim().isEmail().withMessage("Valid email is required"),
    body("phone")
      .trim()
      .custom((value) => {
        // Accept international numbers with or without '+', 8-15 digits (E.164 style)
        const raw = String(value ?? "").trim();
        const normalized = raw.startsWith("+") ? raw : `+${raw}`;
        if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
          throw new Error("Phone must be a valid international number");
        }
        return true;
      }),
    body("CNIC").trim().isLength({ min: 5 }).withMessage("CNIC is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    body("confirmPassword")
      .isLength({ min: 1 })
      .withMessage("Confirm password is required")
      .custom((value, { req }) => {
        if (String(value) !== String(req.body.password)) {
          throw new Error("Passwords do not match");
        }
        return true;
      }),
    body("role")
      .trim()
      .toLowerCase()
      .isIn(allowedRoles)
      .withMessage(`Role must be one of: ${allowedRoles.join(", ")}`)
  ],
  register
);

router.post(
  "/login",
  loginLimiter,
  [
    body("email").trim().isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 1 }).withMessage("Password is required"),
    body("roleHint").optional().trim().toLowerCase().isIn(allowedRoles).withMessage("Invalid roleHint")
  ],
  login
);

router.get("/profile", protect, profile);

router.patch("/active-role", protect, updateActiveRole);

module.exports = router;

