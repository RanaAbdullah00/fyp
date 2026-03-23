const express = require("express");
const { protect, requireAnyRole } = require("../middleware/authMiddleware");
const Bid = require("../models/Bid");
const Load = require("../models/Load");
const User = require("../models/User");
const Truck = require("../models/Truck");

const router = express.Router();

function isExpired(bid) {
  const exp = bid?.expiresAt ? new Date(bid.expiresAt).getTime() : 0;
  return exp > 0 && Date.now() > exp;
}

// Shipper: list bids for my loads
router.get("/", protect, requireAnyRole(["shipper", "admin"]), async (req, res) => {
  const roles = req.auth?.roles || [];
  const isAdmin = roles.includes("admin");

  let loadIds = [];
  if (isAdmin) {
    const loads = await Load.find({}).select("_id").limit(500);
    loadIds = loads.map((l) => l._id);
  } else {
    const loads = await Load.find({ shipperId: req.auth.userId }).select("_id").limit(500);
    loadIds = loads.map((l) => l._id);
  }

  const bids = await Bid.find({ loadId: { $in: loadIds } }).sort({ createdAt: -1 }).limit(500);

  // Attach carrier name (lightweight)
  const carrierIds = Array.from(new Set(bids.map((b) => String(b.carrierId))));
  const carriers = await User.find({ _id: { $in: carrierIds } }).select("name");
  const carrierNameById = new Map(carriers.map((c) => [String(c._id), c.name]));

  return res.json(
    bids.map((b) =>
      b.toJSONSafe({
        carrierName: carrierNameById.get(String(b.carrierId)) || "Carrier",
        vehicleType: "Truck"
      })
    )
  );
});

// Carrier: list my bids
router.get("/mine", protect, requireAnyRole(["carrier", "admin"]), async (req, res) => {
  const bids = await Bid.find({ carrierId: req.auth.userId }).sort({ createdAt: -1 }).limit(500);
  return res.json(bids.map((b) => b.toJSONSafe()));
});

// Carrier: place bid
router.post("/", protect, requireAnyRole(["carrier", "admin"]), async (req, res) => {
  const { loadId, amount, currency, transitTime, note } = req.body || {};
  if (!loadId) return res.status(400).json({ error: "loadId is required" });

  const load = await Load.findById(loadId);
  if (!load) return res.status(404).json({ error: "Not found" });
  if (load.status !== "open") return res.status(409).json({ error: "Load is not open for bidding" });

  const hours = Number(load.deadlineHours || 2);
  const expiresAt = new Date(Date.now() + Math.max(1, hours) * 60 * 60 * 1000);

  const bid = await Bid.create({
    loadId: load._id,
    carrierId: req.auth.userId,
    amount: Number(amount || 0),
    currency: String(currency || "PKR").trim() || "PKR",
    transitTime: Number(transitTime || 2),
    note: String(note || "").trim(),
    status: "pending",
    expiresAt
  });

  return res.status(201).json(bid.toJSONSafe());
});

// Shipper: accept bid (must own the load)
router.put("/:id/accept", protect, requireAnyRole(["shipper", "admin"]), async (req, res) => {
  const bid = await Bid.findById(req.params.id);
  if (!bid) return res.status(404).json({ error: "Not found" });

  if (isExpired(bid)) {
    bid.status = "expired";
    await bid.save();
    return res.status(409).json({ error: "Bid expired" });
  }

  const load = await Load.findById(bid.loadId);
  if (!load) return res.status(404).json({ error: "Not found" });

  const roles = req.auth?.roles || [];
  const isAdmin = roles.includes("admin");
  const isOwner = String(load.shipperId) === String(req.auth.userId);
  if (!isAdmin && !isOwner) return res.status(403).json({ error: "Forbidden" });

  if (load.status !== "open") return res.status(409).json({ error: "Load is not open" });

  // If carrier suggested a rate, use that amount when accepting
  if (bid.status === "suggested" && bid.suggestedBy === "carrier" && bid.suggestedAmount != null) {
    bid.amount = bid.suggestedAmount;
    bid.suggestedAmount = null;
    bid.suggestedAt = null;
    bid.suggestedBy = null;
  }

  // Accept this bid; reject other pending/suggested bids for this load
  await Bid.updateMany(
    { loadId: load._id, status: { $in: ["pending", "suggested"] }, _id: { $ne: bid._id } },
    { $set: { status: "rejected" } }
  );
  bid.status = "accepted";
  await bid.save();

  load.status = "assigned";
  load.assignedCarrierId = bid.carrierId;
  load.acceptedBidId = bid._id;
  await load.save();

  return res.json({ ok: true });
});

// Shipper: reject bid (must own the load)
router.put("/:id/reject", protect, requireAnyRole(["shipper", "admin"]), async (req, res) => {
  const bid = await Bid.findById(req.params.id);
  if (!bid) return res.status(404).json({ error: "Not found" });

  const load = await Load.findById(bid.loadId);
  if (!load) return res.status(404).json({ error: "Not found" });

  const roles = req.auth?.roles || [];
  const isAdmin = roles.includes("admin");
  const isOwner = String(load.shipperId) === String(req.auth.userId);
  if (!isAdmin && !isOwner) return res.status(403).json({ error: "Forbidden" });

  if (bid.status !== "pending") return res.status(409).json({ error: "Bid is not pending" });

  bid.status = "rejected";
  await bid.save();
  return res.json({ ok: true });
});

// Shipper: suggest rate (counter-offer)
router.put("/:id/suggest", protect, requireAnyRole(["shipper", "admin"]), async (req, res) => {
  const { amount } = req.body || {};
  const amt = Number(amount);
  if (!amount || amt < 0 || Number.isNaN(amt)) {
    return res.status(400).json({ error: "Valid amount is required" });
  }

  const bid = await Bid.findById(req.params.id);
  if (!bid) return res.status(404).json({ error: "Not found" });

  const load = await Load.findById(bid.loadId);
  if (!load) return res.status(404).json({ error: "Not found" });

  const roles = req.auth?.roles || [];
  const isAdmin = roles.includes("admin");
  const isOwner = String(load.shipperId) === String(req.auth.userId);
  if (!isAdmin && !isOwner) return res.status(403).json({ error: "Forbidden" });

  if (bid.status !== "pending" && bid.status !== "suggested") {
    return res.status(409).json({ error: "Bid is not available for suggestion" });
  }

  if (isExpired(bid)) {
    bid.status = "expired";
    await bid.save();
    return res.status(409).json({ error: "Bid expired" });
  }

  bid.suggestedAmount = amt;
  bid.suggestedAt = new Date();
  bid.suggestedBy = "shipper";
  bid.status = "suggested";
  await bid.save();

  return res.json({ ok: true, bid: bid.toJSONSafe() });
});

async function carrierHasCompleteTrucks(userId) {
  const trucks = await Truck.find({ userId }).limit(10);
  return trucks.some(
    (t) =>
      (t.engineNumber || t.truckNumber) &&
      (t.truckCardFrontImage || t.truckFrontImage) &&
      (t.truckCardBackImage || t.truckBackImage)
  );
}

// Carrier: accept suggested rate (accept bid at suggested amount)
router.put("/:id/accept-suggestion", protect, requireAnyRole(["carrier", "admin"]), async (req, res) => {
  const roles = req.auth?.roles || [];
  if (!roles.includes("admin")) {
    const hasTrucks = await carrierHasCompleteTrucks(req.auth.userId);
    if (!hasTrucks) {
      return res.status(403).json({ error: "Complete truck details before accepting suggestions" });
    }
  }

  const bid = await Bid.findById(req.params.id);
  if (!bid) return res.status(404).json({ error: "Not found" });

  const isCarrier = String(bid.carrierId) === String(req.auth.userId);
  const isAdmin = roles.includes("admin");
  if (!isAdmin && !isCarrier) return res.status(403).json({ error: "Forbidden" });

  if (bid.status !== "suggested" || !bid.suggestedAmount) {
    return res.status(409).json({ error: "No suggestion to accept" });
  }

  if (isExpired(bid)) {
    bid.status = "expired";
    await bid.save();
    return res.status(409).json({ error: "Bid expired" });
  }

  const load = await Load.findById(bid.loadId);
  if (!load) return res.status(404).json({ error: "Not found" });
  if (load.status !== "open") return res.status(409).json({ error: "Load is not open" });

  bid.amount = bid.suggestedAmount;
  bid.suggestedAmount = null;
  bid.suggestedAt = null;
  bid.suggestedBy = null;
  bid.status = "accepted";
  await bid.save();

  await Bid.updateMany(
    { loadId: load._id, status: { $in: ["pending", "suggested"] }, _id: { $ne: bid._id } },
    { $set: { status: "rejected" } }
  );

  load.status = "assigned";
  load.assignedCarrierId = bid.carrierId;
  load.acceptedBidId = bid._id;
  await load.save();

  return res.json({ ok: true });
});

// Carrier: reject suggested rate
router.put("/:id/reject-suggestion", protect, requireAnyRole(["carrier", "admin"]), async (req, res) => {
  const bid = await Bid.findById(req.params.id);
  if (!bid) return res.status(404).json({ error: "Not found" });

  const isCarrier = String(bid.carrierId) === String(req.auth.userId);
  const roles = req.auth?.roles || [];
  const isAdmin = roles.includes("admin");
  if (!isAdmin && !isCarrier) return res.status(403).json({ error: "Forbidden" });

  if (bid.status !== "suggested") return res.status(409).json({ error: "No suggestion to reject" });

  bid.suggestedAmount = null;
  bid.suggestedAt = null;
  bid.suggestedBy = null;
  bid.status = "pending";
  await bid.save();

  return res.json({ ok: true });
});

// Carrier: suggest rate (revised offer)
router.put("/:id/suggest-carrier", protect, requireAnyRole(["carrier", "admin"]), async (req, res) => {
  const roles = req.auth?.roles || [];
  if (!roles.includes("admin")) {
    const hasTrucks = await carrierHasCompleteTrucks(req.auth.userId);
    if (!hasTrucks) {
      return res.status(403).json({ error: "Complete truck details before suggesting rates" });
    }
  }

  const { amount } = req.body || {};
  const amt = Number(amount);
  if (!amount || amt < 0 || Number.isNaN(amt)) {
    return res.status(400).json({ error: "Valid amount is required" });
  }

  const bid = await Bid.findById(req.params.id);
  if (!bid) return res.status(404).json({ error: "Not found" });

  const isCarrier = String(bid.carrierId) === String(req.auth.userId);
  const isAdmin = roles.includes("admin");
  if (!isAdmin && !isCarrier) return res.status(403).json({ error: "Forbidden" });

  if (bid.status !== "pending" && bid.status !== "suggested") {
    return res.status(409).json({ error: "Bid is not available for suggestion" });
  }

  if (isExpired(bid)) {
    bid.status = "expired";
    await bid.save();
    return res.status(409).json({ error: "Bid expired" });
  }

  bid.suggestedAmount = amt;
  bid.suggestedAt = new Date();
  bid.suggestedBy = "carrier";
  bid.status = "suggested";
  await bid.save();

  return res.json({ ok: true, bid: bid.toJSONSafe() });
});

module.exports = router;

