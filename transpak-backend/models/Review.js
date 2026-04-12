const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    loadId: { type: mongoose.Schema.Types.ObjectId, ref: "Load", default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

reviewSchema.index(
  { fromUser: 1, loadId: 1 },
  {
    unique: true,
    partialFilterExpression: { loadId: { $exists: true, $ne: null } }
  }
);

reviewSchema.methods.toJSONSafe = function toJSONSafe() {
  return {
    id: this._id.toString(),
    fromUser: this.fromUser?.toString?.() || String(this.fromUser),
    toUser: this.toUser?.toString?.() || String(this.toUser),
    loadId: this.loadId ? this.loadId.toString() : null,
    rating: this.rating,
    comment: this.comment,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model("Review", reviewSchema);
