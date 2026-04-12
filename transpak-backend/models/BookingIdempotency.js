const mongoose = require("mongoose");

/**
 * Stores completed booking-confirm responses for Idempotency-Key replay (per user + key).
 * TTL: 24 hours (Mongo TTL index).
 */
const bookingIdempotencySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true, maxlength: 128 },
    statusCode: { type: Number, required: true, min: 100, max: 599 },
    body: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

bookingIdempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });
bookingIdempotencySchema.index({ userId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("BookingIdempotency", bookingIdempotencySchema);
