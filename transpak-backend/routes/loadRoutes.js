const express = require("express");
const { body, validationResult } = require("express-validator");
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

function escapeRegexLiteral(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, errors.array()[0]?.msg || "Validation error", {
      fields: errors.array().map((e) => e.path)
    });
  }
  return next();
}

router.get("/", protect, requireAnyRole(["carrier", "admin"]), requireActiveRole("carrier"), async (req, res) => {
  try {
    const { origin, destination, vehicleType, city, minPrice, maxPrice } = req.query || {};
    const and = [{ status: "open" }];

    if (origin) and.push({ origin: new RegExp(escapeRegexLiteral(String(origin).trim()), "i") });
    if (destination) and.push({ destination: new RegExp(escapeRegexLiteral(String(destination).trim()), "i") });
    if (vehicleType) and.push({ vehicleType: new RegExp(escapeRegexLiteral(String(vehicleType).trim()), "i") });
    if (city) {
      const c = new RegExp(escapeRegexLiteral(String(city).trim()), "i");
      and.push({ $or: [{ origin: c }, { destination: c }] });
    }

    const minRaw = minPrice !== undefined && String(minPrice).trim() !== "" ? String(minPrice).trim() : "";
    const maxRaw = maxPrice !== undefined && String(maxPrice).trim() !== "" ? String(maxPrice).trim() : "";
    if (minRaw && !Number.isFinite(Number(minRaw))) return sendError(res, 400, "minPrice must be a valid number");
    if (maxRaw && !Number.isFinite(Number(maxRaw))) return sendError(res, 400, "maxPrice must be a valid number");
    const minN = minRaw ? Number(minRaw) : null;
    const maxN = maxRaw ? Number(maxRaw) : null;
    if (minN != null && maxN != null && minN > maxN) return sendError(res, 400, "minPrice cannot exceed maxPrice");
    if (minN != null || maxN != null) {
      const range = {};
      if (minN != null) range.$gte = minN;
      if (maxN != null) range.$lte = maxN;
      if (Object.keys(range).length) and.push({ expectedPrice: range });
    }

    const q = and.length === 1 ? and[0] : { $and: and };
    const loads = await Load.find(q).sort({ createdAt: -1 }).limit(200);
    return sendSuccess(res, 200, loads.map((l) => l.toJSONSafe()));
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
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

const createLoadValidators = [
  body("cargo").trim().isLength({ min: 2, max: 200 }).withMessage("cargo must be 2-200 chars"),
  body("origin").trim().isLength({ min: 2, max: 120 }).withMessage("origin must be 2-120 chars"),
  body("destination").trim().isLength({ min: 2, max: 120 }).withMessage("destination must be 2-120 chars"),
  body("weight").toFloat().isFloat({ min: 0 }).withMessage("weight must be a non-negative number"),
  body("vehicleType")
    .optional()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("vehicleType must be 2-80 chars"),
  body("expectedPrice")
    .optional({ nullable: true })
    .toFloat()
    .isFloat({ min: 0 })
    .withMessage("expectedPrice must be non-negative"),
  body("price")
    .optional({ nullable: true })
    .toFloat()
    .isFloat({ min: 0 })
    .withMessage("price must be non-negative"),
  body("pickupDate").trim().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("pickupDate must be YYYY-MM-DD"),
  body("deadlineHours")
    .optional({ nullable: true })
    .toInt()
    .isInt({ min: 1, max: 72 })
    .withMessage("deadlineHours must be 1-72")
];

router.post("/", protect, requireAnyRole(["shipper", "admin"]), requireActiveRole("shipper"), createLoadValidators, validate, createLoad);
router.post("/create", protect, requireAnyRole(["shipper", "admin"]), requireActiveRole("shipper"), createLoadValidators, validate, createLoad);

module.exports = router;
