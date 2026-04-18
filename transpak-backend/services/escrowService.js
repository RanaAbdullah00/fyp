const mongoose = require("mongoose");
const WalletLedger = require("../models/WalletLedger");

function cleanRef(ref) {
  const s = String(ref || "").trim();
  return s || null;
}

async function createHeldEntriesForBooking({ loadId, bidId, bookingReference, shipperId, carrierId, amount }, session) {
  const ref = cleanRef(bookingReference);
  if (!ref || !shipperId || !carrierId || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return;

  const amt = Number(amount);
  const baseMeta = {
    phase: "escrow",
    loadId: String(loadId || ""),
    bidId: String(bidId || ""),
    bookingReference: ref
  };

  const docs = [
    {
      userId: new mongoose.Types.ObjectId(String(shipperId)),
      amount: amt,
      type: "debit",
      description: `Escrow hold for booking ${ref}`,
      provider: "escrow",
      externalId: `${ref}:shipper:hold`,
      status: "held",
      meta: baseMeta
    },
    {
      userId: new mongoose.Types.ObjectId(String(carrierId)),
      amount: amt,
      type: "credit",
      description: `Escrow hold for booking ${ref}`,
      provider: "escrow",
      externalId: `${ref}:carrier:hold`,
      status: "held",
      meta: baseMeta
    }
  ];

  await WalletLedger.insertMany(docs, { session, ordered: true });
}

async function transitionEscrowByBooking(bookingReference, fromStates, toState, session) {
  const ref = cleanRef(bookingReference);
  if (!ref) return { matched: 0, modified: 0 };
  const states = Array.isArray(fromStates) ? fromStates : [fromStates];
  const res = await WalletLedger.updateMany(
    {
      provider: "escrow",
      "meta.bookingReference": ref,
      status: { $in: states }
    },
    {
      $set: {
        status: toState
      }
    },
    session ? { session } : {}
  );
  return { matched: res.matchedCount || 0, modified: res.modifiedCount || 0 };
}

module.exports = {
  createHeldEntriesForBooking,
  transitionEscrowByBooking
};
