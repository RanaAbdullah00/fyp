const express = require("express");
const { body } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { uploadProfileImages } = require("../middleware/uploadProfileImages");
const { getProfile, updateProfile, getProfileStatus } = require("../controllers/profileController");

const router = express.Router();

router.get("/", protect, getProfile);
router.get("/status", protect, getProfileStatus);

router.put(
  "/update",
  protect,
  uploadProfileImages,
  [
    body("full_name").optional().trim().isLength({ min: 2, max: 120 }).withMessage("full_name must be 2-120 chars"),
    body("phone")
      .optional()
      .trim()
      .custom((value) => {
        const raw = String(value ?? "").trim();
        const normalized = raw.startsWith("+") ? raw : `+${raw}`;
        if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
          throw new Error("Phone must be a valid international number");
        }
        return true;
      }),
    body("cnic_number").optional().trim().isLength({ min: 15, max: 15 }).withMessage("Invalid CNIC")
      .matches(/^[0-9]{5}-[0-9]{7}-[0-9]{1}$/)
      .withMessage("CNIC must be XXXXX-XXXXXXX-X")
  ],
  updateProfile
);

module.exports = router;

