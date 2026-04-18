const express = require("express");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const WalletLedger = require("../models/WalletLedger");
const User = require("../models/User");
const logger = require("../utils/logger");

const router = express.Router();

const PAYMENT_STATUSES = ["pending", "held", "released", "refunded", "failed"];

function resolvePaymentStatus(req) {
  const raw = String(req.body?.outcome || "").trim().toLowerCase();
  if (PAYMENT_STATUSES.includes(raw)) return raw;
  return "pending";
}

router.post(
  "/simulate",
  protect,
  [
    body("amount")
      .toFloat()
      .isFloat({ gt: 0, lt: 1e12 })
      .withMessage("Amount must be a positive number"),
    body("provider")
      .optional()
      .trim()
      .isLength({ min: 1, max: 64 })
      .withMessage("Invalid provider"),
    body("outcome")
      .optional()
      .trim()
      .isIn(PAYMENT_STATUSES)
      .withMessage("outcome must be pending, held, released, refunded, or failed"),
    body("bookingReference").optional().trim().isLength({ min: 1, max: 80 }).withMessage("Invalid bookingReference"),
    body("shipmentId").optional().trim().isLength({ min: 1, max: 80 }).withMessage("Invalid shipmentId")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const first = errors.array()[0];
        return sendError(res, 400, first.msg || "Validation error", {
          fields: errors.array().map((e) => e.path)
        });
      }

      const paymentStatus = resolvePaymentStatus(req);
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const amount = Number(req.body.amount);
      const provider = String(req.body.provider || "wallet").slice(0, 64);

      const user = await User.findById(req.auth.userId).select("activeRole roles");
      const roles = user?.roles || [];
      const active = user?.activeRole || "";
      const isCarrier = active === "carrier" || roles.includes("carrier");
      const type = isCarrier ? "credit" : "debit";
      const description = isCarrier ? `Received via ${provider}` : `Payment via ${provider}`;
      try {
        await WalletLedger.create({
          userId: new mongoose.Types.ObjectId(String(req.auth.userId)),
          amount,
          type,
          description,
          provider,
          externalId: transactionId,
          status: paymentStatus,
          meta: {
            simulated: true,
            bookingReference: req.body?.bookingReference ? String(req.body.bookingReference).trim() : undefined,
            shipmentId: req.body?.shipmentId ? String(req.body.shipmentId).trim() : undefined
          }
        });
      } catch (err) {
        if (err && err.code === 11000) {
          logger.warn("wallet_ledger_duplicate_tx", { transactionId });
        } else {
          logger.error("wallet_ledger_write_failed", { err: err.message });
        }
      }

      return sendSuccess(
        res,
        200,
        {
          paymentStatus,
          transactionId,
          amount,
          provider
        },
        paymentStatus === "released"
          ? "Payment released"
          : paymentStatus === "held"
            ? "Payment held in escrow"
            : paymentStatus === "refunded"
              ? "Payment refunded"
              : paymentStatus === "pending"
                ? "Payment pending"
                : "Payment failed"
      );
    } catch (err) {
      logger.error("payment_simulate_failed", { err: err.message });
      return sendError(res, 500, err.message || "Server error");
    }
  }
);

module.exports = router;
