const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { listMine, createMine, markRead, unreadCount } = require("../controllers/notificationController");

const router = express.Router();

router.get("/unread-count", protect, unreadCount);
router.get("/", protect, listMine);
router.post("/", protect, createMine);
router.patch("/:id/read", protect, markRead);

module.exports = router;
