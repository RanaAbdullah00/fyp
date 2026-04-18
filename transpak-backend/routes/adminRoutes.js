const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const User = require("../models/User");
const Load = require("../models/Load");
const Bid = require("../models/Bid");
const Review = require("../models/Review");
const Dispute = require("../models/Dispute");
const ShipmentTrack = require("../models/ShipmentTrack");
const escrowService = require("../services/escrowService");
const uploadDemo = require("../middleware/uploadDemoVideo");
const { adminUpload } = require("../controllers/demoVideoController");

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

router.use(protect, requireRole("admin"));

router.get("/users", async (req, res) => {
  const users = await User.find({}).sort({ createdAt: -1 }).limit(500);
  return sendSuccess(res, 200, users.map((u) => u.toAuthJSON()));
});

router.patch(
  "/users/:id/block",
  [param("id").isMongoId().withMessage("Invalid user id"), body("blocked").isBoolean().withMessage("blocked must be boolean")],
  validate,
  async (req, res) => {
  const { blocked } = req.body || {};
  const user = await User.findById(req.params.id);
  if (!user) return sendError(res, 404, "Not found");
  user.blocked = Boolean(blocked);
  await user.save();
  return sendSuccess(res, 200, { ok: true, user: user.toAuthJSON() });
});

router.patch(
  "/users/:id/verify",
  [param("id").isMongoId().withMessage("Invalid user id"), body("verified").isBoolean().withMessage("verified must be boolean")],
  validate,
  async (req, res) => {
  const { verified } = req.body || {};
  const user = await User.findById(req.params.id);
  if (!user) return sendError(res, 404, "Not found");
  user.verified = Boolean(verified);
  await user.save();
  return sendSuccess(res, 200, { ok: true, user: user.toAuthJSON() });
});

router.get("/loads", async (req, res) => {
  const loads = await Load.find({}).sort({ createdAt: -1 }).limit(500);
  return sendSuccess(res, 200, loads.map((l) => l.toJSONSafe()));
});

router.delete("/loads/:id", async (req, res) => {
  const load = await Load.findById(req.params.id);
  if (!load) return sendError(res, 404, "Not found");
  await Bid.deleteMany({ loadId: load._id });
  await load.deleteOne();
  return sendSuccess(res, 200, { ok: true });
});

router.get("/shipments", async (req, res) => {
  const loads = await Load.find({ status: { $in: ["assigned", "in_transit", "delivered"] } })
    .sort({ updatedAt: -1 })
    .limit(500);
  const data = loads.map((l) => ({
    id: l._id.toString(),
    code: l.code,
    origin: l.origin,
    destination: l.destination,
    status: l.status === "assigned" ? "pending" : l.status
  }));
  return sendSuccess(res, 200, data);
});

router.patch(
  "/shipments/:id/status",
  [
    param("id").isMongoId().withMessage("Invalid shipment id"),
    body("status").isIn(["pending", "in_transit", "delivered", "cancelled"]).withMessage("Invalid status")
  ],
  validate,
  async (req, res) => {
  const incoming = String(req.body?.status || "").trim().toLowerCase();
  const map = {
    pending: "assigned",
    in_transit: "in_transit",
    delivered: "delivered",
    cancelled: "cancelled"
  };
  const next = map[incoming];
  if (!next) return sendError(res, 400, "Invalid status");

  const load = await Load.findById(req.params.id);
  if (!load) return sendError(res, 404, "Not found");
  load.status = next;
  await load.save();

  const track = await ShipmentTrack.findOne({ $or: [{ loadId: load._id }, { refKey: load.code }] });
  if (track) {
    track.tracking = { ...(track.tracking || {}), status: next === "assigned" ? "booked" : next };
    await track.save();
  }
  if (next === "delivered") {
    await escrowService.transitionEscrowByBooking(load.bookingReference, ["held"], "released");
  } else if (next === "cancelled") {
    await escrowService.transitionEscrowByBooking(load.bookingReference, ["held", "released"], "refunded");
  }

  return sendSuccess(res, 200, { ok: true });
});

router.get("/disputes", async (req, res) => {
  const list = await Dispute.find({}).sort({ createdAt: -1 }).limit(500);
  return sendSuccess(
    res,
    200,
    list.map((d) => ({
      id: d._id.toString(),
      shipmentId: d.shipmentId?.toString?.() || null,
      loadCode: d.loadCode || null,
      reason: d.reason,
      status: d.status,
      raisedBy: d.raisedBy?.toString?.() || null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }))
  );
});

router.patch(
  "/disputes/:id/resolve",
  [
    param("id").isMongoId().withMessage("Invalid dispute id"),
    body("status").optional().isIn(["resolved", "rejected"]).withMessage("Invalid status")
  ],
  validate,
  async (req, res) => {
  const next = String(req.body?.status || "resolved").trim().toLowerCase();
  if (!["resolved", "rejected"].includes(next)) return sendError(res, 400, "Invalid status");
  const dispute = await Dispute.findById(req.params.id);
  if (!dispute) return sendError(res, 404, "Not found");
  dispute.status = next;
  dispute.resolvedBy = req.auth.userId;
  dispute.resolvedAt = new Date();
  await dispute.save();
  const load = await Load.findById(dispute.shipmentId).select("bookingReference");
  if (load?.bookingReference) {
    await escrowService.transitionEscrowByBooking(load.bookingReference, ["held", "released"], "refunded");
  }
  return sendSuccess(res, 200, { ok: true });
});

router.post("/demo-video", (req, res, next) => {
  uploadDemo.single("video")(req, res, (err) => {
    if (err) return sendError(res, 400, err.message || "Upload failed");
    next();
  });
}, adminUpload);

router.get("/stats", async (req, res) => {
  try {
    const [users, loads, bids, activeShipments, reviews] = await Promise.all([
      User.countDocuments({}),
      Load.countDocuments({}),
      Bid.countDocuments({}),
      Load.countDocuments({ status: { $in: ["assigned", "in_transit"] } }),
      Review.countDocuments({})
    ]);
    return sendSuccess(res, 200, {
      totalUsers: users,
      totalLoads: loads,
      totalShipments: loads,
      activeShipments,
      totalBids: bids,
      totalReviews: reviews
    });
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
});

module.exports = router;
