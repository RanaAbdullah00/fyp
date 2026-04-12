const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { sendError } = require("../utils/apiResponse");
const {
  openConversation,
  listConversations,
  listMessages,
  postMessage,
  markRead
} = require("../controllers/chatController");

const router = express.Router();

function handleVal(req, res, next) {
  const e = validationResult(req);
  if (!e.isEmpty()) {
    const first = e.array()[0];
    return sendError(res, 400, first.msg || "Validation failed");
  }
  return next();
}

router.post(
  "/conversations/open",
  protect,
  body("peerUserId").trim().isMongoId().withMessage("Invalid peerUserId"),
  body("loadId").optional().trim().isMongoId().withMessage("Invalid loadId"),
  handleVal,
  openConversation
);

router.get("/conversations", protect, listConversations);

router.get(
  "/conversations/:id/messages",
  protect,
  param("id").isMongoId(),
  query("before").optional().trim().isMongoId(),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  handleVal,
  listMessages
);

router.post(
  "/conversations/:id/messages",
  protect,
  param("id").isMongoId(),
  body("body").trim().isLength({ min: 1, max: 2000 }).withMessage("Invalid body"),
  body("clientMessageId").optional().trim().isLength({ max: 128 }),
  handleVal,
  postMessage
);

router.post(
  "/conversations/:id/read",
  protect,
  param("id").isMongoId(),
  body("upToMessageId").optional().trim().isMongoId(),
  handleVal,
  markRead
);

module.exports = router;
