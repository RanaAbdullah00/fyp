const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const router = express.Router();

const shipments = new Map();

function getOrCreateShipment(id) {
  const key = String(id);
  if (shipments.has(key)) return shipments.get(key);

  const data = {
    tracking: {
      status: "in_transit",
      eta: "Tonight 11:30 PM",
      currentLocation: [28.4, 70.3]
    },
    history: [
      { event: "Picked up", time: "Today 8:15 AM", location: "Lahore" },
      { event: "In transit", time: "Today 12:40 PM", location: "Near Sukkur" }
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
  const data = getOrCreateShipment(req.params.id);
  return sendSuccess(res, 200, data);
});

router.put("/:id/status", protect, (req, res) => {
  const { status } = req.body || {};
  const next = String(status || "").trim();
  if (!next) return sendError(res, 400, "Status is required");

  const data = getOrCreateShipment(req.params.id);
  data.tracking = {
    ...(data.tracking || {}),
    status: next
  };
  data.history = Array.isArray(data.history) ? data.history : [];
  data.history.unshift({
    event: `Status: ${next}`,
    time: new Date().toLocaleString(),
    location: "System"
  });

  shipments.set(String(req.params.id), data);
  return sendSuccess(res, 200, data);
});

module.exports = router;
