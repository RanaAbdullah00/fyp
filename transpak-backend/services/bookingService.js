const mongoose = require("mongoose");
const Bid = require("../models/Bid");
const Load = require("../models/Load");
const escrowService = require("./escrowService");
const { BookingError, BOOKING_ERROR_CODES } = require("../utils/bookingErrors");

function isExpired(bid) {
  const exp = bid?.expiresAt ? new Date(bid.expiresAt).getTime() : 0;
  return exp > 0 && Date.now() > exp;
}

/** Mongo ObjectId-based token: practically unique; avoids application-level ref collisions. */
function generateBookingReference() {
  return `TPK-${new mongoose.Types.ObjectId().toString().toUpperCase()}`;
}

function isTransactionUnsupportedError(err) {
  const msg = String(err?.message || err || "");
  return (
    msg.includes("replica set") ||
    msg.includes("Transaction numbers") ||
    msg.includes("transactions are only supported") ||
    (msg.includes("mongos") && msg.includes("transaction"))
  );
}

function assertBidLoadIntegrity(bid, load) {
  if (!bid?.loadId || !load?._id || !load._id.equals(bid.loadId)) {
    throw new BookingError(BOOKING_ERROR_CODES.BOOKING_INTEGRITY, 400, "Bid and load do not match");
  }
}

async function revertLoadClaim(loadId, bookingReference, bidId, session) {
  const opts = session ? { session } : {};
  await Load.findOneAndUpdate(
    {
      _id: loadId,
      status: "assigned",
      acceptedBidId: bidId,
      bookingReference
    },
    {
      $set: {
        status: "open",
        assignedCarrierId: null,
        acceptedBidId: null,
        bookingReference: null
      }
    },
    opts
  );
}

/**
 * Atomic load claim + bid settlement. With Mongo transaction: rollback on failure.
 * Without session: compensating revert if bid save / reject-others fails after claim.
 */
async function claimLoadAndSettleBids(bid, session) {
  const maxRefAttempts = 6;
  let lastDup = false;

  for (let attempt = 0; attempt < maxRefAttempts; attempt++) {
    const ref = generateBookingReference();
    const filter = {
      _id: bid.loadId,
      status: "open",
      $or: [{ assignedCarrierId: null }, { assignedCarrierId: { $exists: false } }]
    };
    const update = {
      $set: {
        status: "assigned",
        assignedCarrierId: bid.carrierId,
        acceptedBidId: bid._id,
        bookingReference: ref
      }
    };
    const opts = { new: true };
    if (session) opts.session = session;

    let updatedLoad;
    try {
      updatedLoad = await Load.findOneAndUpdate(filter, update, opts);
    } catch (err) {
      if (err && err.code === 11000) {
        lastDup = true;
        continue;
      }
      throw err;
    }

    if (!updatedLoad) {
      throw new BookingError(
        BOOKING_ERROR_CODES.BOOKING_LOAD_CONFLICT,
        409,
        "Load is not available for booking"
      );
    }

    const bidSnapshot = {
      status: bid.status,
      amount: bid.amount,
      suggestedAmount: bid.suggestedAmount,
      suggestedAt: bid.suggestedAt,
      suggestedBy: bid.suggestedBy
    };

    try {
      bid.status = "accepted";
      await bid.save(session ? { session } : {});
      await Bid.updateMany(
        {
          loadId: bid.loadId,
          _id: { $ne: bid._id },
          status: { $in: ["pending", "suggested"] }
        },
        { $set: { status: "rejected" } },
        session ? { session } : {}
      );
      await escrowService.createHeldEntriesForBooking(
        {
          loadId: updatedLoad._id,
          bidId: bid._id,
          bookingReference: ref,
          shipperId: updatedLoad.shipperId,
          carrierId: updatedLoad.assignedCarrierId,
          amount: bid.amount
        },
        session
      );
      return {
        bookingReference: ref,
        loadId: updatedLoad._id.toString(),
        bidId: bid._id.toString()
      };
    } catch (err) {
      if (!session) {
        await revertLoadClaim(updatedLoad._id, ref, bid._id, null);
        await Bid.findOneAndUpdate(
          { _id: bid._id, status: "accepted" },
          {
            $set: {
              status: bidSnapshot.status,
              amount: bidSnapshot.amount,
              suggestedAmount: bidSnapshot.suggestedAmount,
              suggestedAt: bidSnapshot.suggestedAt,
              suggestedBy: bidSnapshot.suggestedBy
            }
          }
        );
      }
      throw err;
    }
  }

  throw new BookingError(
    BOOKING_ERROR_CODES.BOOKING_INTERNAL,
    500,
    lastDup ? "Could not allocate a unique booking reference" : "Booking claim failed"
  );
}

async function runConfirmedBookingTx(bidId, prepareBid) {
  const run = async (session) => {
    const bid = session
      ? await Bid.findById(bidId).session(session)
      : await Bid.findById(bidId);
    if (!bid) {
      throw new BookingError(BOOKING_ERROR_CODES.BOOKING_BID_NOT_FOUND, 404, "Not found");
    }

    if (isExpired(bid)) {
      bid.status = "expired";
      await bid.save(session ? { session } : {});
      throw new BookingError(BOOKING_ERROR_CODES.BOOKING_BID_EXPIRED, 409, "Bid expired");
    }

    const load = session
      ? await Load.findById(bid.loadId).session(session)
      : await Load.findById(bid.loadId);
    if (!load) {
      throw new BookingError(BOOKING_ERROR_CODES.BOOKING_LOAD_NOT_FOUND, 404, "Not found");
    }

    assertBidLoadIntegrity(bid, load);

    if (
      bid.status === "accepted" &&
      load.status === "assigned" &&
      String(load.acceptedBidId) === String(bid._id)
    ) {
      return {
        bookingReference: load.bookingReference || null,
        loadId: load._id.toString(),
        bidId: bid._id.toString(),
        idempotent: true
      };
    }

    prepareBid(bid, load);

    return claimLoadAndSettleBids(bid, session);
  };

  const session = await mongoose.startSession();
  try {
    let data;
    await session.withTransaction(async () => {
      data = await run(session);
    });
    return data;
  } catch (err) {
    if (err instanceof BookingError) throw err;
    if (isTransactionUnsupportedError(err)) {
      try {
        return await run(null);
      } catch (err2) {
        if (err2 instanceof BookingError) throw err2;
        const wrapped = new BookingError(
          BOOKING_ERROR_CODES.BOOKING_INTERNAL,
          500,
          err2.message || "Booking failed"
        );
        wrapped.cause = err2;
        throw wrapped;
      }
    }
    const wrapped = new BookingError(
      BOOKING_ERROR_CODES.BOOKING_INTERNAL,
      500,
      err.message || "Booking failed"
    );
    wrapped.cause = err;
    throw wrapped;
  } finally {
    await session.endSession();
  }
}

function assertShipperCanAct(load, actorUserId, roles) {
  const isAdmin = Array.isArray(roles) && roles.includes("admin");
  const isOwner = String(load.shipperId) === String(actorUserId);
  if (!isAdmin && !isOwner) {
    throw new BookingError(BOOKING_ERROR_CODES.BOOKING_FORBIDDEN, 403, "Forbidden");
  }
}

function assertCarrierOwnsBid(bid, actorUserId, roles) {
  const isAdmin = Array.isArray(roles) && roles.includes("admin");
  const isCarrier = String(bid.carrierId) === String(actorUserId);
  if (!isAdmin && !isCarrier) {
    throw new BookingError(BOOKING_ERROR_CODES.BOOKING_FORBIDDEN, 403, "Forbidden");
  }
}

async function shipperAcceptBid(bidId, actorUserId, roles) {
  return runConfirmedBookingTx(bidId, (bid, load) => {
    assertShipperCanAct(load, actorUserId, roles);

    if (bid.status === "suggested" && bid.suggestedBy === "carrier" && bid.suggestedAmount != null) {
      bid.amount = bid.suggestedAmount;
      bid.suggestedAmount = null;
      bid.suggestedAt = null;
      bid.suggestedBy = null;
    }

    if (!["pending", "suggested"].includes(bid.status)) {
      throw new BookingError(BOOKING_ERROR_CODES.BOOKING_INVALID_STATE, 409, "Bid is not pending");
    }
  });
}

async function carrierAcceptSuggestion(bidId, actorUserId, roles) {
  return runConfirmedBookingTx(bidId, (bid, load) => {
    assertCarrierOwnsBid(bid, actorUserId, roles);

    if (bid.status !== "suggested" || bid.suggestedAmount == null) {
      throw new BookingError(BOOKING_ERROR_CODES.BOOKING_NO_SUGGESTION, 409, "No suggestion to accept");
    }

    bid.amount = bid.suggestedAmount;
    bid.suggestedAmount = null;
    bid.suggestedAt = null;
    bid.suggestedBy = null;
  });
}

module.exports = {
  shipperAcceptBid,
  carrierAcceptSuggestion,
  generateBookingReference,
  isExpired
};
