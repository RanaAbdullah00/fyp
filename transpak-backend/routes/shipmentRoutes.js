const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const {
  normalizeShipmentStatus,
  validateShipmentTransition
} = require("../utils/shipmentStatus");

const router = express.Router();

const shipments = new Map();

function getOrCreateShipment(id) {
  const key = String(id);
  if (shipments.has(key)) return shipments.get(key);

  const data = {
    tracking: {
      status: "posted",
      eta: "Tonight 11:30 PM",
      currentLocation: [31.5204, 74.3587]
    },
    history: [
      {
        event: "Load posted",
        time: new Date().toLocaleString(),
        location: "System"
      }
    ],
    liveTrackingMap: {
      coordinates: [
        [31.5204, 74.3587],
        [30.2, 71.5],
        [28.4, 70.3],
        [24.8607, 67.0011]
      ]
    }
  };

  shipments.set(key, data);
  return data;
}

router.get("/track/:id", protect, (req, res) => {
  try {
    const data = getOrCreateShipment(req.params.id);
    const canonical = normalizeShipmentStatus(data.tracking?.status) || "posted";
    data.tracking = { ...(data.tracking || {}), status: canonical };
    return sendSuccess(res, 200, data);
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
});

router.put("/:id/status", protect, (req, res) => {
  try {
    const { status } = req.body || {};
    const nextRaw = String(status || "").trim();
    if (!nextRaw) return sendError(res, 400, "Status is required");

    const data = getOrCreateShipment(req.params.id);
    const current = data.tracking?.status;
    const check = validateShipmentTransition(current, nextRaw);
    if (!check.ok) return sendError(res, 400, check.message);

    const canonical = check.canonical;
    if (check.same) {
      return sendSuccess(res, 200, data);
    }

    data.tracking = {
      ...(data.tracking || {}),
      status: canonical
    };
    data.history = Array.isArray(data.history) ? data.history : [];
    data.history.unshift({
      event: `Status: ${canonical}`,
      time: new Date().toLocaleString(),
      location: "System"
    });

    shipments.set(String(req.params.id), data);
    return sendSuccess(res, 200, data);
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
});

module.exports = router;
