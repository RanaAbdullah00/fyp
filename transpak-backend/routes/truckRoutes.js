const express = require("express");
const { protect, requireAnyRole } = require("../middleware/authMiddleware");
const Truck = require("../models/Truck");

const router = express.Router();

// POST /api/trucks (carrier/admin)
router.post("/", protect, requireAnyRole(["carrier", "admin"]), async (req, res) => {
  const { engineNumber, truckType, capacity, licensePlate, truckCardFrontImage, truckCardBackImage } = req.body || {};
  if (!engineNumber || !truckType || !licensePlate || !truckCardFrontImage || !truckCardBackImage) {
    return res
      .status(400)
      .json({ error: "engineNumber, truckType, licensePlate, truckCardFrontImage, and truckCardBackImage are required" });
  }

  const truck = await Truck.create({
    userId: req.auth.userId,
    engineNumber: String(engineNumber).trim(),
    truckType: String(truckType).trim(),
    capacity: Number(capacity || 0),
    licensePlate: String(licensePlate).trim(),
    truckCardFrontImage: String(truckCardFrontImage).trim(),
    truckCardBackImage: String(truckCardBackImage).trim()
  });

  return res.status(201).json(truck.toJSONSafe());
});

// GET /api/trucks/mine (carrier/admin)
router.get("/mine", protect, requireAnyRole(["carrier", "admin"]), async (req, res) => {
  const trucks = await Truck.find({ userId: req.auth.userId }).sort({ createdAt: -1 }).limit(100);
  return res.json(trucks.map((t) => t.toJSONSafe()));
});

// PUT /api/trucks/:id (carrier/admin) - only owner (unless admin)
router.put("/:id", protect, requireAnyRole(["carrier", "admin"]), async (req, res) => {
  const truck = await Truck.findById(req.params.id);
  if (!truck) return res.status(404).json({ error: "Not found" });

  const roles = req.auth?.roles || [];
  const isAdmin = roles.includes("admin");
  if (!isAdmin && String(truck.userId) !== String(req.auth.userId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { engineNumber, truckType, capacity, licensePlate, truckCardFrontImage, truckCardBackImage } = req.body || {};
  if (engineNumber != null) truck.engineNumber = String(engineNumber).trim();
  if (truckType != null) truck.truckType = String(truckType).trim();
  if (capacity != null) truck.capacity = Number(capacity || 0);
  if (licensePlate != null) truck.licensePlate = String(licensePlate).trim();
  if (truckCardFrontImage != null) truck.truckCardFrontImage = String(truckCardFrontImage).trim();
  if (truckCardBackImage != null) truck.truckCardBackImage = String(truckCardBackImage).trim();
  await truck.save();

  return res.json(truck.toJSONSafe());
});

module.exports = router;

