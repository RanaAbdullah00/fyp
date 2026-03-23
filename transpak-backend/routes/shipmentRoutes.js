const express = require("express");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Minimal demo shipment tracking data (kept in-memory for FYP UI stability)
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

// GET /api/shipments/track/:id
router.get("/track/:id", protect, (req, res) => {
  const data = getOrCreateShipment(req.params.id);
  return res.json(data);
});

// PUT /api/shipments/:id/status
router.put("/:id/status", protect, (req, res) => {
  const { status } = req.body || {};
  const next = String(status || "").trim();
  if (!next) return res.status(400).json({ error: "Status is required" });

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
  return res.json(data);
});

module.exports = router;

