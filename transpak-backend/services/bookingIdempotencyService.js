const BookingIdempotency = require("../models/BookingIdempotency");
const { BookingError, BOOKING_ERROR_CODES } = require("../utils/bookingErrors");

const KEY_MIN = 8;
const KEY_MAX = 128;

function normalizeIdempotencyKey(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.length < KEY_MIN || s.length > KEY_MAX) {
    throw new BookingError(BOOKING_ERROR_CODES.BOOKING_IDEMPOTENCY_KEY_INVALID, 400, "Idempotency-Key must be 8–128 characters");
  }
  return s;
}

async function findReplay(userId, key) {
  if (!userId || !key) return null;
  const doc = await BookingIdempotency.findOne({ userId: String(userId), key }).lean();
  if (!doc) return null;
  return { statusCode: doc.statusCode, body: doc.body };
}

/**
 * Persist response for replay. On unique-index race, returns the winner's stored row.
 */
async function recordReplay(userId, key, statusCode, body) {
  try {
    await BookingIdempotency.create({
      userId: String(userId),
      key,
      statusCode,
      body
    });
    return { stored: true, replay: null };
  } catch (err) {
    if (err && err.code === 11000) {
      const existing = await BookingIdempotency.findOne({ userId: String(userId), key }).lean();
      if (existing) {
        return { stored: false, replay: { statusCode: existing.statusCode, body: existing.body } };
      }
    }
    throw err;
  }
}

module.exports = {
  normalizeIdempotencyKey,
  findReplay,
  recordReplay
};
