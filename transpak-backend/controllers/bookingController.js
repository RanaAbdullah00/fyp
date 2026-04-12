const Truck = require("../models/Truck");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const bookingService = require("../services/bookingService");
const idempotency = require("../services/bookingIdempotencyService");
const { BookingError, BOOKING_ERROR_CODES } = require("../utils/bookingErrors");

async function carrierHasCompleteTrucks(userId) {
  const trucks = await Truck.find({ userId }).limit(10);
  return trucks.some(
    (t) =>
      (t.engineNumber || t.truckNumber) &&
      (t.truckCardFrontImage || t.truckFrontImage) &&
      (t.truckCardBackImage || t.truckBackImage)
  );
}

function buildSuccessBody(message, data) {
  return { success: true, message, data };
}

function resolveIdempotencyKey(req) {
  try {
    return idempotency.normalizeIdempotencyKey(req.get("Idempotency-Key"));
  } catch (e) {
    if (e instanceof BookingError) return e;
    throw e;
  }
}

async function shipperAcceptBid(req, res) {
  const keyResult = resolveIdempotencyKey(req);
  if (keyResult instanceof BookingError) {
    return sendError(res, keyResult.statusCode, keyResult.message, null, keyResult.code);
  }
  const idemKey = keyResult;

  if (idemKey) {
    const replay = await idempotency.findReplay(req.auth.userId, idemKey);
    if (replay) return res.status(replay.statusCode).json(replay.body);
  }

  try {
    const data = await bookingService.shipperAcceptBid(req.params.id, req.auth.userId, req.auth.roles || []);
    const message = data.idempotent ? "Already confirmed" : "OK";
    const payload = {
      ok: true,
      bookingReference: data.bookingReference,
      loadId: data.loadId,
      bidId: data.bidId
    };
    if (data.idempotent) payload.idempotent = true;

    const body = buildSuccessBody(message, payload);

    if (idemKey) {
      const rec = await idempotency.recordReplay(req.auth.userId, idemKey, 200, body);
      if (rec.replay) return res.status(rec.replay.statusCode).json(rec.replay.body);
    }

    return sendSuccess(res, 200, payload, message);
  } catch (err) {
    const status = err.statusCode || 500;
    const code = err.code || BOOKING_ERROR_CODES.BOOKING_INTERNAL;
    const msg = err.message || "Server error";

    if (idemKey && status < 500) {
      const errBody = { success: false, message: msg, code, data: null };
      const rec = await idempotency.recordReplay(req.auth.userId, idemKey, status, errBody);
      if (rec.replay) return res.status(rec.replay.statusCode).json(rec.replay.body);
    }

    return sendError(res, status, msg, null, code);
  }
}

async function carrierAcceptSuggestion(req, res) {
  const keyResult = resolveIdempotencyKey(req);
  if (keyResult instanceof BookingError) {
    return sendError(res, keyResult.statusCode, keyResult.message, null, keyResult.code);
  }
  const idemKey = keyResult;

  if (idemKey) {
    const replay = await idempotency.findReplay(req.auth.userId, idemKey);
    if (replay) return res.status(replay.statusCode).json(replay.body);
  }

  try {
    const roles = req.auth?.roles || [];
    if (!roles.includes("admin")) {
      const hasTrucks = await carrierHasCompleteTrucks(req.auth.userId);
      if (!hasTrucks) {
        const msg = "Complete truck details before accepting suggestions";
        if (idemKey) {
          const errBody = {
            success: false,
            message: msg,
            code: BOOKING_ERROR_CODES.BOOKING_TRUCK_PROFILE,
            data: null
          };
          const rec = await idempotency.recordReplay(req.auth.userId, idemKey, 403, errBody);
          if (rec.replay) return res.status(rec.replay.statusCode).json(rec.replay.body);
        }
        return sendError(res, 403, msg, null, BOOKING_ERROR_CODES.BOOKING_TRUCK_PROFILE);
      }
    }

    const data = await bookingService.carrierAcceptSuggestion(req.params.id, req.auth.userId, roles);
    const message = data.idempotent ? "Already confirmed" : "OK";
    const payload = {
      ok: true,
      bookingReference: data.bookingReference,
      loadId: data.loadId,
      bidId: data.bidId
    };
    if (data.idempotent) payload.idempotent = true;

    const body = buildSuccessBody(message, payload);

    if (idemKey) {
      const rec = await idempotency.recordReplay(req.auth.userId, idemKey, 200, body);
      if (rec.replay) return res.status(rec.replay.statusCode).json(rec.replay.body);
    }

    return sendSuccess(res, 200, payload, message);
  } catch (err) {
    const status = err.statusCode || 500;
    const code = err.code || BOOKING_ERROR_CODES.BOOKING_INTERNAL;
    const msg = err.message || "Server error";

    if (idemKey && status < 500) {
      const errBody = { success: false, message: msg, code, data: null };
      const rec = await idempotency.recordReplay(req.auth.userId, idemKey, status, errBody);
      if (rec.replay) return res.status(rec.replay.statusCode).json(rec.replay.body);
    }

    return sendError(res, status, msg, null, code);
  }
}

module.exports = {
  shipperAcceptBid,
  carrierAcceptSuggestion
};
