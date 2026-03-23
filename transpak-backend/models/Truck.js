const mongoose = require("mongoose");

const truckSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    engineNumber: { type: String, trim: true, maxlength: 40 },
    truckNumber: { type: String, trim: true, maxlength: 40 },
    truckType: { type: String, required: true, trim: true, maxlength: 40 },
    capacity: { type: Number, required: true, min: 0 },
    licensePlate: { type: String, required: true, trim: true, maxlength: 40 },
    truckCardFrontImage: { type: String, trim: true, maxlength: 250000 },
    truckCardBackImage: { type: String, trim: true, maxlength: 250000 },
    truckFrontImage: { type: String, trim: true, maxlength: 250000 },
    truckBackImage: { type: String, trim: true, maxlength: 250000 }
  },
  { timestamps: true }
);

truckSchema.pre("save", function (next) {
  if (!this.engineNumber && this.truckNumber) this.engineNumber = this.truckNumber;
  if (!this.truckCardFrontImage && this.truckFrontImage) this.truckCardFrontImage = this.truckFrontImage;
  if (!this.truckCardBackImage && this.truckBackImage) this.truckCardBackImage = this.truckBackImage;
  next();
});

truckSchema.methods.toJSONSafe = function toJSONSafe() {
  return {
    id: this._id.toString(),
    userId: this.userId?.toString?.() || String(this.userId),
    engineNumber: this.engineNumber || this.truckNumber,
    truckNumber: this.truckNumber || this.engineNumber,
    truckType: this.truckType,
    capacity: this.capacity,
    licensePlate: this.licensePlate,
    truckCardFrontImage: this.truckCardFrontImage || this.truckFrontImage,
    truckCardBackImage: this.truckCardBackImage || this.truckBackImage,
    truckFrontImage: this.truckFrontImage || this.truckCardFrontImage,
    truckBackImage: this.truckBackImage || this.truckCardBackImage,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model("Truck", truckSchema);

