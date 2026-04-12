const express = require("express");
const { protect, requireAnyRole, requireActiveRole } = require("../middleware/authMiddleware");
const { shipperAcceptBid, carrierAcceptSuggestion } = require("../controllers/bookingController");
const { validateBookingBidParam, bookingConfirmValidation } = require("../middleware/validateBookingConfirm");

const router = express.Router();

router.put(
  "/bids/:id/accept",
  protect,
  requireAnyRole(["shipper", "admin"]),
  requireActiveRole("shipper"),
  ...validateBookingBidParam,
  bookingConfirmValidation,
  shipperAcceptBid
);

router.put(
  "/bids/:id/accept-suggestion",
  protect,
  requireAnyRole(["carrier", "admin"]),
  requireActiveRole("carrier"),
  ...validateBookingBidParam,
  bookingConfirmValidation,
  carrierAcceptSuggestion
);

module.exports = router;
