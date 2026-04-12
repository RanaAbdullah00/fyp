const mongoose = require("mongoose");

/** Persists shipment tracking previously held in-memory (Map). */
const shipmentTrackSchema = new mongoose.Schema(
  {
    refKey: { type: String, required: true, unique: true, trim: true, index: true },
    loadId: { type: mongoose.Schema.Types.ObjectId, ref: "Load", default: null },
    tracking: { type: mongoose.Schema.Types.Mixed, default: {} },
    history: { type: [mongoose.Schema.Types.Mixed], default: [] },
    liveTrackingMap: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ShipmentTrack", shipmentTrackSchema);
