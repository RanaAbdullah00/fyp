const express = require("express");
const mongoose = require("mongoose");
const { protect, requireAnyRole, requireActiveRole } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { normalizeShipmentStatus, validateShipmentTransition } = require("../utils/shipmentStatus");
const Load = require("../models/Load");
const escrowService = require("../services/escrowService");
const {
  shipmentIdParam,
  shipmentStatusPutValidators,
  handleValidationErrors
} = require("../middleware/validateShipmentBody");
const shipmentTrackService = require("../services/shipmentTrackService");

const router = express.Router();

function validLatLng(pair) {
  return (
    Array.isArray(pair) &&
    pair.length >= 2 &&
    Number.isFinite(Number(pair[0])) &&
    Number.isFinite(Number(pair[1]))
  );
}

function attachLocationFields(req, tracking) {
  const devSimFail =
    process.env.NODE_ENV !== "production" && String(req.query.simulateGpsFailure || "") === "1";
  const coords = tracking?.currentLocation;
  const hasValid = validLatLng(coords);
  const locationUnavailable = Boolean(tracking?.locationUnavailable) || devSimFail || !hasValid;
  const location = locationUnavailable ? null : [Number(coords[0]), Number(coords[1])];
  return {
    ...tracking,
    status: normalizeShipmentStatus(tracking?.status) || "posted",
    location,
    locationUnavailable,
    currentLocation: location
  };
}

function toTrackResponse(req, doc) {
  const raw = {
    tracking: doc.tracking || {},
    history: doc.history || [],
    liveTrackingMap: doc.liveTrackingMap || {}
  };
  const tracking = attachLocationFields(req, raw.tracking || {});
  return {
    ...raw,
    tracking
  };
}

async function resolveLoadForRef(refKey) {
  const key = String(refKey || "").trim();
  if (!key) return null;
  if (mongoose.isValidObjectId(key)) {
    const byId = await Load.findById(key).select("_id shipperId assignedCarrierId");
    if (byId) return byId;
  }
  return Load.findOne({ code: key }).select("_id shipperId assignedCarrierId");
}

function assertTrackAccessOrThrow(load, auth, { allowCarrierStatusWrite = false } = {}) {
  const roles = auth?.roles || [];
  const isAdmin = roles.includes("admin");
  if (isAdmin) return;

  const uid = String(auth?.userId || "");
  const isShipper = String(load?.shipperId || "") === uid;
  const isAssignedCarrier = String(load?.assignedCarrierId || "") === uid;
  if (isShipper) return;
  if (allowCarrierStatusWrite && isAssignedCarrier) return;
  throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
}

router.get(
  "/track/:id",
  protect,
  requireAnyRole(["shipper", "carrier", "admin"]),
  shipmentIdParam,
  handleValidationErrors,
  async (req, res) => {
    try {
      const load = await resolveLoadForRef(req.params.id);
      if (!load) return sendError(res, 404, "Not found");
      assertTrackAccessOrThrow(load, req.auth, { allowCarrierStatusWrite: false });

      const doc = await shipmentTrackService.getOrCreateTrack(req.params.id);
      if (!doc.loadId) {
        doc.loadId = load._id;
        await shipmentTrackService.saveTrack(doc);
      }
      return sendSuccess(res, 200, toTrackResponse(req, doc));
    } catch (err) {
      const status = err.statusCode || 500;
      return sendError(res, status, err.message || "Server error");
    }
  }
);

router.put(
  "/:id/status",
  protect,
  requireAnyRole(["carrier", "admin"]),
  requireActiveRole("carrier"),
  shipmentIdParam,
  shipmentStatusPutValidators,
  handleValidationErrors,
  async (req, res) => {
    try {
      const load = await resolveLoadForRef(req.params.id);
      if (!load) return sendError(res, 404, "Not found");
      assertTrackAccessOrThrow(load, req.auth, { allowCarrierStatusWrite: true });

      const { status } = req.body || {};
      const nextRaw = String(status || "").trim();

      const doc = await shipmentTrackService.getOrCreateTrack(req.params.id);
      const current = doc.tracking?.status;
      const check = validateShipmentTransition(current, nextRaw);
      if (!check.ok) return sendError(res, 400, check.message);

      const canonical = check.canonical;
      if (check.same) {
        return sendSuccess(res, 200, toTrackResponse(req, doc));
      }

      doc.tracking = {
        ...(doc.tracking || {}),
        status: canonical
      };
      doc.history = Array.isArray(doc.history) ? doc.history : [];
      doc.history.unshift({
        event: `Status: ${canonical}`,
        time: new Date().toLocaleString(),
        location: "System"
      });

      await shipmentTrackService.saveTrack(doc);
      if (canonical === "delivered") {
        await escrowService.transitionEscrowByBooking(load.bookingReference, ["held"], "released");
      }
      const payload = toTrackResponse(req, doc);
      await shipmentTrackService.emitTrackingToParties(load._id, {
        refKey: doc.refKey,
        ...payload
      });
      return sendSuccess(res, 200, payload);
    } catch (err) {
      const status = err.statusCode || 500;
      return sendError(res, status, err.message || "Server error");
    }
  }
);

module.exports = router;
