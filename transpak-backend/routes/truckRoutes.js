const express = require("express");
const { protect, requireAnyRole, requireActiveRole } = require("../middleware/authMiddleware");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const Truck = require("../models/Truck");

const router = express.Router();

router.post("/", protect, requireAnyRole(["carrier", "admin"]), requireActiveRole("carrier"), async (req, res) => {
  const { engineNumber, truckType, capacity, licensePlate, truckCardFrontImage, truckCardBackImage } = req.body || {};
  if (!engineNumber || !truckType || !licensePlate || !truckCardFrontImage || !truckCardBackImage) {
    return sendError(
      res,
      400,
      "engineNumber, truckType, licensePlate, truckCardFrontImage, and truckCardBackImage are required"
    );
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

  return sendSuccess(res, 201, truck.toJSONSafe(), "Created");
});

router.get("/mine", protect, requireAnyRole(["carrier", "admin"]), requireActiveRole("carrier"), async (req, res) => {
  const trucks = await Truck.find({ userId: req.auth.userId }).sort({ createdAt: -1 }).limit(100);
  return sendSuccess(res, 200, trucks.map((t) => t.toJSONSafe()));
});

router.put("/:id", protect, requireAnyRole(["carrier", "admin"]), requireActiveRole("carrier"), async (req, res) => {
  const truck = await Truck.findById(req.params.id);
  if (!truck) return sendError(res, 404, "Not found");

  const roles = req.auth?.roles || [];
  const isAdmin = roles.includes("admin");
  if (!isAdmin && String(truck.userId) !== String(req.auth.userId)) {
    return sendError(res, 403, "Forbidden");
  }

  const { engineNumber, truckType, capacity, licensePlate, truckCardFrontImage, truckCardBackImage } = req.body || {};
  if (engineNumber != null) truck.engineNumber = String(engineNumber).trim();
  if (truckType != null) truck.truckType = String(truckType).trim();
  if (capacity != null) truck.capacity = Number(capacity || 0);
  if (licensePlate != null) truck.licensePlate = String(licensePlate).trim();
  if (truckCardFrontImage != null) truck.truckCardFrontImage = String(truckCardFrontImage).trim();
  if (truckCardBackImage != null) truck.truckCardBackImage = String(truckCardBackImage).trim();
  await truck.save();

  return sendSuccess(res, 200, truck.toJSONSafe());
});

module.exports = router;
