const express = require("express");
const { body } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { createReview, listReviewsForUser } = require("../controllers/reviewController");
const { validationResult } = require("express-validator");
const { sendError } = require("../utils/apiResponse");

const router = express.Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, errors.array()[0]?.msg || "Validation error");
  }
  next();
}

router.post(
  "/",
  protect,
  [
    body("toUser").trim().notEmpty().withMessage("toUser is required"),
    body("rating").isInt({ min: 1, max: 5 }).withMessage("rating must be 1–5"),
    body("comment").optional().isString(),
    body("loadId").optional().trim()
  ],
  validate,
  createReview
);

router.get("/:userId", protect, listReviewsForUser);

module.exports = router;
