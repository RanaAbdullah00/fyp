const express = require("express");
const { body, validationResult } = require("express-validator");
const { protect } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const Load = require("../models/Load");
const Dispute = require("../models/Dispute");
const escrowService = require("../services/escrowService");

const router = express.Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, errors.array()[0]?.msg || "Validation error");
  }
  return next();
}

router.post(
  "/",
  protect,
  [
    body("shipmentId").isString().trim().notEmpty().withMessage("shipmentId is required"),
    body("reason").isString().trim().isLength({ min: 10, max: 2000 }).withMessage("reason must be 10-2000 chars")
  ],
  validate,
  async (req, res) => {
    const shipmentId = String(req.body.shipmentId).trim();
    const load = await Load.findById(shipmentId);
    if (!load) return sendError(res, 404, "Shipment not found");

    const uid = String(req.auth.userId);
    const isAdmin = (req.auth.roles || []).includes("admin");
    const isShipper = String(load.shipperId) === uid;
    const isCarrier = String(load.assignedCarrierId || "") === uid;
    if (!isAdmin && !isShipper && !isCarrier) return sendError(res, 403, "Forbidden");

    const existing = await Dispute.findOne({ shipmentId: load._id, raisedBy: req.auth.userId, status: "open" });
    if (existing) return sendError(res, 409, "An open dispute already exists for this shipment");

    const doc = await Dispute.create({
      shipmentId: load._id,
      loadCode: load.code || "",
      raisedBy: req.auth.userId,
      reason: String(req.body.reason || "").trim()
    });
    await escrowService.transitionEscrowByBooking(load.bookingReference, ["held"], "refunded");
    return sendSuccess(res, 201, {
      id: doc._id.toString(),
      shipmentId: doc.shipmentId.toString(),
      reason: doc.reason,
      status: doc.status
    });
  }
);

router.get("/mine", protect, async (req, res) => {
    const list = await Dispute.find({ raisedBy: req.auth.userId }).sort({ createdAt: -1 }).limit(200);
    return sendSuccess(
      res,
      200,
      list.map((d) => ({
        id: d._id.toString(),
        shipmentId: d.shipmentId?.toString?.() || null,
        loadCode: d.loadCode || null,
        reason: d.reason,
        status: d.status,
        createdAt: d.createdAt
      }))
    );
  }
);

module.exports = router;
