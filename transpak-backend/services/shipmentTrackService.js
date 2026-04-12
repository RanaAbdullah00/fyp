const mongoose = require("mongoose");
const ShipmentTrack = require("../models/ShipmentTrack");
const Load = require("../models/Load");
const { emitToUser } = require("./realtimeHub");
const logger = require("../utils/logger");

function defaultPayload() {
  return {
    tracking: {
      status: "posted",
      eta: "Tonight 11:30 PM",
      currentLocation: [31.5204, 74.3587],
      locationUnavailable: false
    },
    history: [
      {
        event: "Load posted",
        time: new Date().toLocaleString(),
        location: "System"
      }
    ],
    liveTrackingMap: {
      coordinates: [
        [31.5204, 74.3587],
        [30.2, 71.5],
        [28.4, 70.3],
        [24.8607, 67.0011]
      ]
    }
  };
}

async function resolveLoadRefKey(refKey) {
  const key = String(refKey || "").trim();
  if (!key) return { loadId: null, refKey: key };
  if (mongoose.isValidObjectId(key)) {
    const load = await Load.findById(key).select("_id");
    if (load) return { loadId: load._id, refKey: key };
  }
  const byCode = await Load.findOne({ code: key }).select("_id");
  if (byCode) return { loadId: byCode._id, refKey: key };
  return { loadId: null, refKey: key };
}

async function getOrCreateTrack(refKey) {
  const key = String(refKey || "").trim();
  let doc = await ShipmentTrack.findOne({ refKey: key });
  if (doc) return doc;

  const defaults = defaultPayload();
  const { loadId } = await resolveLoadRefKey(key);

  try {
    doc = await ShipmentTrack.create({
      refKey: key,
      loadId,
      ...defaults
    });
  } catch (err) {
    if (err && err.code === 11000) {
      doc = await ShipmentTrack.findOne({ refKey: key });
    } else {
      throw err;
    }
  }
  return doc;
}

async function saveTrack(doc) {
  await doc.save();
  return doc;
}

async function emitTrackingToParties(loadId, payload) {
  if (!loadId) return;
  try {
    const load = await Load.findById(loadId).select("shipperId assignedCarrierId");
    if (!load) return;
    if (load.shipperId) emitToUser(load.shipperId, "tracking:update", payload);
    if (load.assignedCarrierId) emitToUser(load.assignedCarrierId, "tracking:update", payload);
  } catch (err) {
    logger.warn("tracking_emit_failed", { err: err.message });
  }
}

module.exports = {
  getOrCreateTrack,
  saveTrack,
  defaultPayload,
  emitTrackingToParties
};
