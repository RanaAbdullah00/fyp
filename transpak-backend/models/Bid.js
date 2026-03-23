const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    loadId: { type: mongoose.Schema.Types.ObjectId, ref: "Load", required: true, index: true },
    carrierId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "PKR", trim: true, maxlength: 8 },
    transitTime: { type: Number, required: true, min: 1, max: 30 },
    note: { type: String, default: "", trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "withdrawn", "expired", "suggested"],
      default: "pending"
    },
    suggestedAmount: { type: Number, default: null },
    suggestedAt: { type: Date, default: null },
    suggestedBy: { type: String, enum: ["shipper", "carrier"], default: null },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

bidSchema.methods.toJSONSafe = function toJSONSafe(extra = {}) {
  return {
    id: this._id.toString(),
    loadId: this.loadId?.toString?.() || String(this.loadId),
    carrierId: this.carrierId?.toString?.() || String(this.carrierId),
    amount: this.amount,
    currency: this.currency || "PKR",
    transitTime: this.transitTime,
    note: this.note,
    status: this.status,
    suggestedAmount: this.suggestedAmount,
    suggestedAt: this.suggestedAt,
    suggestedBy: this.suggestedBy,
    createdAt: this.createdAt,
    expiresAt: this.expiresAt,
    ...extra
  };
};

module.exports = mongoose.model("Bid", bidSchema);

