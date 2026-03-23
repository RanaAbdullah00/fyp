const mongoose = require("mongoose");

const loadSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    cargo: { type: String, required: true, trim: true },
    origin: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    weight: { type: Number, required: true, min: 0 },
    vehicleType: { type: String, required: true, trim: true },
    expectedPrice: { type: Number, required: true, min: 0 },
    pickupDate: { type: String, required: true, trim: true }, // ISO date string (YYYY-MM-DD)
    deadlineHours: { type: Number, default: 2, min: 1, max: 72 },
    status: {
      type: String,
      enum: ["open", "assigned", "in_transit", "delivered", "cancelled"],
      default: "open"
    },
    shipperId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedCarrierId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    acceptedBidId: { type: mongoose.Schema.Types.ObjectId, ref: "Bid", default: null }
  },
  { timestamps: true }
);

loadSchema.methods.toJSONSafe = function toJSONSafe() {
  return {
    id: this._id.toString(),
    code: this.code,
    cargo: this.cargo,
    origin: this.origin,
    destination: this.destination,
    weight: this.weight,
    vehicleType: this.vehicleType,
    expectedPrice: this.expectedPrice,
    pickupDate: this.pickupDate,
    deadlineHours: this.deadlineHours,
    status: this.status,
    shipperId: this.shipperId?.toString?.() || String(this.shipperId),
    assignedCarrierId: this.assignedCarrierId?.toString?.() || (this.assignedCarrierId ? String(this.assignedCarrierId) : null),
    acceptedBidId: this.acceptedBidId?.toString?.() || (this.acceptedBidId ? String(this.acceptedBidId) : null),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model("Load", loadSchema);

