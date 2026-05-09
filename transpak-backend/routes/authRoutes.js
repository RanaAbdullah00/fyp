const express = require("express");
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");
const { register, login, profile, updateActiveRole, addRoleToAccount } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const userRepo = require("../repositories/userRepo");

const router = express.Router();

const allowedRoles = userRepo.ALLOWED_ROLES;
const registerableRoles = allowedRoles.filter((r) => r !== "admin");

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
    body("CNIC")
      .trim()
      .matches(/^[0-9]{5}-[0-9]{7}-[0-9]{1}$/)
      .withMessage("CNIC must be XXXXX-XXXXXXX-X"),
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
      .isIn(registerableRoles)
      .withMessage(`Role must be one of: ${registerableRoles.join(", ")}`)
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

router.post(
  "/add-role",
  protect,
  [body("role").trim().toLowerCase().isIn(registerableRoles).withMessage("Invalid role")],
  addRoleToAccount
);

module.exports = router;

