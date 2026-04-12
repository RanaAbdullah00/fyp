const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { summary, listTransactions } = require("../controllers/walletController");

const router = express.Router();

router.get("/summary", protect, summary);
router.get("/transactions", protect, listTransactions);

module.exports = router;
