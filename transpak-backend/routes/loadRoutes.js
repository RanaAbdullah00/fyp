const express = require("express");
const { protect, requireAnyRole, requireActiveRole } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");
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

router.get("/", protect, requireAnyRole(["carrier", "admin"]), requireActiveRole("carrier"), async (req, res) => {
  const { origin, destination, vehicleType } = req.query || {};

  const q = { status: "open" };
  if (origin) q.origin = new RegExp(String(origin).trim(), "i");
  if (destination) q.destination = new RegExp(String(destination).trim(), "i");
  if (vehicleType) q.vehicleType = new RegExp(String(vehicleType).trim(), "i");

  const loads = await Load.find(q).sort({ createdAt: -1 }).limit(200);
  return sendSuccess(res, 200, loads.map((l) => l.toJSONSafe()));
});

router.get("/mine", protect, requireAnyRole(["shipper", "admin"]), requireActiveRole("shipper"), async (req, res) => {
  const loads = await Load.find({ shipperId: req.auth.userId }).sort({ createdAt: -1 }).limit(200);
  return sendSuccess(res, 200, loads.map((l) => l.toJSONSafe()));
});

router.get("/:id", protect, async (req, res) => {
  const load = await Load.findById(req.params.id);
  if (!load) return sendError(res, 404, "Not found");

  const roles = req.auth?.roles || [];
  const isAdmin = roles.includes("admin");
  const isOwner = String(load.shipperId) === String(req.auth.userId);
  const isAssignedCarrier = load.assignedCarrierId && String(load.assignedCarrierId) === String(req.auth.userId);

  if (!isAdmin && !isOwner && !isAssignedCarrier) return sendError(res, 403, "Forbidden");
  return sendSuccess(res, 200, load.toJSONSafe());
});

async function createLoad(req, res) {
  const user = await User.findById(req.auth.userId);
  if (!user) return sendError(res, 401, "Unauthorized");
  const u = user.toAuthJSON();
  if (!u.profileComplete) {
    return sendError(res, 403, "Complete your profile (address + CNIC images) to post loads");
  }
  const { cargo, origin, destination, weight, type, vehicleType, price, expectedPrice, pickupDate, deadlineHours } =
    req.body || {};

  const pickup = String(pickupDate || "").trim();
  if (!isISODateOnly(pickup)) return sendError(res, 400, "pickupDate must be YYYY-MM-DD");

  const today = startOfTodayUTC();
  const pickupDt = new Date(`${pickup}T00:00:00.000Z`);
  if (!(pickupDt.getTime() > today.getTime())) {
    return sendError(res, 400, "Pickup date must be in the future");
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

  return sendSuccess(res, 201, load.toJSONSafe(), "Created");
}

router.post("/", protect, requireAnyRole(["shipper", "admin"]), requireActiveRole("shipper"), createLoad);
router.post("/create", protect, requireAnyRole(["shipper", "admin"]), requireActiveRole("shipper"), createLoad);

module.exports = router;
