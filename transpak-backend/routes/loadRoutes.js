const express = require("express");
const { protect, requireAnyRole } = require("../middleware/authMiddleware");
const Load = require("../models/Load");
const User = require("../models/User");

const router = express.Router();

function isISODateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function startOfTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function generateCode() {
  return `L-${Math.floor(100000 + Math.random() * 900000)}`;
}

// Carrier marketplace: list open loads
router.get("/", protect, requireAnyRole(["carrier", "admin"]), async (req, res) => {
  const { origin, destination, vehicleType } = req.query || {};

  const q = { status: "open" };
  if (origin) q.origin = new RegExp(String(origin).trim(), "i");
  if (destination) q.destination = new RegExp(String(destination).trim(), "i");
  if (vehicleType) q.vehicleType = new RegExp(String(vehicleType).trim(), "i");

  const loads = await Load.find(q).sort({ createdAt: -1 }).limit(200);
  return res.json(loads.map((l) => l.toJSONSafe()));
});

// Shipper: list my loads
router.get("/mine", protect, requireAnyRole(["shipper", "admin"]), async (req, res) => {
  const loads = await Load.find({ shipperId: req.auth.userId }).sort({ createdAt: -1 }).limit(200);
  return res.json(loads.map((l) => l.toJSONSafe()));
});

// Shared: load detail (allowed for shipper owner, assigned carrier, or admin)
router.get("/:id", protect, async (req, res) => {
  const load = await Load.findById(req.params.id);
  if (!load) return res.status(404).json({ error: "Not found" });

  const roles = req.auth?.roles || [];
  const isAdmin = roles.includes("admin");
  const isOwner = String(load.shipperId) === String(req.auth.userId);
  const isAssignedCarrier = load.assignedCarrierId && String(load.assignedCarrierId) === String(req.auth.userId);

  if (!isAdmin && !isOwner && !isAssignedCarrier) return res.status(403).json({ error: "Forbidden" });
  return res.json(load.toJSONSafe());
});

// Shipper: create load (compat alias /create to match frontend)
async function createLoad(req, res) {
  const user = await User.findById(req.auth.userId);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const u = user.toAuthJSON();
  if (!u.profileComplete) {
    return res.status(403).json({ error: "Complete your profile (address + CNIC images) to post loads" });
  }
  const { cargo, origin, destination, weight, type, vehicleType, price, expectedPrice, pickupDate, deadlineHours } =
    req.body || {};

  const pickup = String(pickupDate || "").trim();
  if (!isISODateOnly(pickup)) return res.status(400).json({ error: "pickupDate must be YYYY-MM-DD" });

  // future date only (tomorrow or later) in UTC
  const today = startOfTodayUTC();
  const pickupDt = new Date(`${pickup}T00:00:00.000Z`);
  if (!(pickupDt.getTime() > today.getTime())) {
    return res.status(400).json({ error: "Pickup date must be in the future" });
  }

  const load = await Load.create({
    code: generateCode(),
    cargo: String(cargo || "Load").trim(),
    origin: String(origin || "").trim(),
    destination: String(destination || "").trim(),
    weight: Number(weight || 0),
    vehicleType: String(vehicleType || type || "Truck").trim(),
    expectedPrice: Number(expectedPrice ?? price ?? 0),
    pickupDate: pickup,
    deadlineHours: Number(deadlineHours || 2),
    shipperId: req.auth.userId
  });

  return res.status(201).json(load.toJSONSafe());
}

router.post("/", protect, requireAnyRole(["shipper", "admin"]), createLoad);
router.post("/create", protect, requireAnyRole(["shipper", "admin"]), createLoad);

module.exports = router;

