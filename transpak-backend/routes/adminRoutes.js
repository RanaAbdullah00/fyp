const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const User = require("../models/User");
const Load = require("../models/Load");
const Bid = require("../models/Bid");
const Dispute = require("../models/Dispute");
const ShipmentTrack = require("../models/ShipmentTrack");
const escrowService = require("../services/escrowService");
const shipmentTrackService = require("../services/shipmentTrackService");
const { normalizeShipmentStatus, validateShipmentTransition } = require("../utils/shipmentStatus");
const { loadStatusFromCanonicalTrack } = require("../utils/shipmentLoadSync");
const uploadDemo = require("../middleware/uploadDemoVideo");
const { adminUpload } = require("../controllers/demoVideoController");
const adminController = require("../controllers/adminController");

/** Map admin UI / legacy body values to canonical next status (before validateShipmentTransition). */
function resolveAdminNextCanonical(currentCanonical, bodyStatus) {
  const raw = String(bodyStatus || "").trim();
  if (!raw) return null;
  const legacy = raw.toLowerCase();
  if (legacy === "pending") return "booked";
  if (legacy === "in_transit" || legacy.replace(/\s+/g, "") === "intransit") {
    return currentCanonical === "booked" ? "pickedup" : "intransit";
  }
  return normalizeShipmentStatus(raw);
}

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

router.get("/stats", adminController.getStats);
router.get("/users", adminController.getUsers);
router.get("/loads", adminController.getLoads);

router.delete("/user/:id", [param("id").isMongoId().withMessage("Invalid user id")], validate, adminController.deleteUser);

router.patch(
  "/user/:id/role",
  ...adminController.patchUserRoleValidators,
  validate,
  adminController.patchUserRole
);

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

router.delete("/loads/:id", async (req, res) => {
  const load = await Load.findById(req.params.id);
  if (!load) return sendError(res, 404, "Not found");
  await Bid.deleteMany({ loadId: load._id });
  await ShipmentTrack.deleteMany({
    $or: [{ loadId: load._id }, { refKey: load.code }, { refKey: load._id.toString() }]
  });
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
    body("status")
      .trim()
      .isLength({ min: 1, max: 40 })
      .withMessage("status is required")
  ],
  validate,
  async (req, res) => {
    try {
      const load = await Load.findById(req.params.id);
      if (!load) return sendError(res, 404, "Not found");

      let doc =
        (await ShipmentTrack.findOne({ loadId: load._id })) ||
        (await ShipmentTrack.findOne({ refKey: load.code })) ||
        (await shipmentTrackService.getOrCreateTrack(load._id.toString()));
      if (!doc.loadId) {
        doc.loadId = load._id;
        await shipmentTrackService.saveTrack(doc);
      }

      const current = doc.tracking?.status;
      const currentCanon = normalizeShipmentStatus(current) || "posted";
      const desired = resolveAdminNextCanonical(currentCanon, req.body.status);
      if (!desired) return sendError(res, 400, "Invalid status");

      const check = validateShipmentTransition(current, desired);
      if (!check.ok) return sendError(res, 400, check.message);

      const canonical = check.canonical;
      if (check.same) {
        return sendSuccess(res, 200, { ok: true, trackingStatus: canonical, loadStatus: load.status });
      }

      doc.tracking = { ...(doc.tracking || {}), status: canonical };
      doc.history = Array.isArray(doc.history) ? doc.history : [];
      doc.history.unshift({
        event: `Status: ${canonical} (admin)`,
        time: new Date().toLocaleString(),
        location: "System"
      });
      await shipmentTrackService.saveTrack(doc);

      const nextLoadStatus = loadStatusFromCanonicalTrack(load, canonical);
      if (nextLoadStatus) {
        load.status = nextLoadStatus;
        await load.save();
      }

      if (canonical === "delivered") {
        await escrowService.transitionEscrowByBooking(load.bookingReference, ["held"], "released");
      }

      return sendSuccess(res, 200, { ok: true, trackingStatus: canonical, loadStatus: load.status });
    } catch (err) {
      return sendError(res, 500, err.message || "Server error");
    }
  }
);

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

module.exports = router;
