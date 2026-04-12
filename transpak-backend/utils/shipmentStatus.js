/** Canonical in-memory shipment lifecycle (strict linear forward). */
const SHIPMENT_ORDER = ["posted", "booked", "pickedup", "intransit", "delivered"];

const LEGACY_TO_CANON = {
  posted: "posted",
  booked: "booked",
  pickedup: "pickedup",
  picked: "pickedup",
  intransit: "intransit",
  delivered: "delivered",
  pending: "posted",
  open: "posted"
};

function normalizeShipmentStatus(raw) {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  const mapped = LEGACY_TO_CANON[key];
  if (mapped) return mapped;
  if (SHIPMENT_ORDER.includes(key)) return key;
  return null;
}

function validateShipmentTransition(currentRaw, nextRaw) {
  const current = normalizeShipmentStatus(currentRaw) || "posted";
  const next = normalizeShipmentStatus(nextRaw);
  if (!next) return { ok: false, message: "Invalid status" };
  const i = SHIPMENT_ORDER.indexOf(current);
  const j = SHIPMENT_ORDER.indexOf(next);
  if (i < 0 || j < 0) return { ok: false, message: "Invalid status" };
  if (j === i) return { ok: true, same: true, canonical: next };
  if (j !== i + 1) return { ok: false, message: "Invalid status transition" };
  return { ok: true, same: false, canonical: next };
}

module.exports = {
  SHIPMENT_ORDER,
  normalizeShipmentStatus,
  validateShipmentTransition
};
