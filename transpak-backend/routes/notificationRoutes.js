const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { sendError } = require("../utils/apiResponse");
const { listMine, createMine, markRead, unreadCount } = require("../controllers/notificationController");

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

router.get("/unread-count", protect, unreadCount);
router.get("/", protect, listMine);
router.post(
  "/",
  protect,
  [
    body("title").trim().isLength({ min: 1, max: 120 }).withMessage("title is required"),
    body("message").trim().isLength({ min: 1, max: 2000 }).withMessage("message is required"),
    body("roleType").optional().trim().isLength({ max: 32 }).withMessage("Invalid roleType")
  ],
  validate,
  createMine
);
router.patch("/:id/read", protect, [param("id").isMongoId().withMessage("Invalid notification id")], validate, markRead);

module.exports = router;
