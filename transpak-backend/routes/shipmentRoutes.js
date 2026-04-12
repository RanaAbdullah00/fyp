const express = require("express");
const { protect, requireAnyRole, requireActiveRole } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { normalizeShipmentStatus, validateShipmentTransition } = require("../utils/shipmentStatus");
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

router.get(
  "/track/:id",
  protect,
  requireAnyRole(["shipper", "carrier", "admin"]),
  shipmentIdParam,
  handleValidationErrors,
  async (req, res) => {
    try {
      const doc = await shipmentTrackService.getOrCreateTrack(req.params.id);
      return sendSuccess(res, 200, toTrackResponse(req, doc));
    } catch (err) {
      return sendError(res, 500, err.message || "Server error");
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
      const payload = toTrackResponse(req, doc);
      await shipmentTrackService.emitTrackingToParties(doc.loadId, {
        refKey: doc.refKey,
        ...payload
      });
      return sendSuccess(res, 200, payload);
    } catch (err) {
      return sendError(res, 500, err.message || "Server error");
    }
  }
);

module.exports = router;
