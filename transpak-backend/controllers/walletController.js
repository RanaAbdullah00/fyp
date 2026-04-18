const mongoose = require("mongoose");
const WalletLedger = require("../models/WalletLedger");
const { sendSuccess, sendError } = require("../utils/apiResponse");

async function summary(req, res) {
  try {
    const uid = new mongoose.Types.ObjectId(String(req.auth.userId));
    const BALANCE_STATES = ["released", "success"];
    const agg = await WalletLedger.aggregate([
      { $match: { userId: uid, status: { $in: BALANCE_STATES } } },
      {
        $group: {
          _id: null,
          credits: { $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0] } },
          debits: { $sum: { $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0] } }
        }
      }
    ]);
    const row = agg[0] || { credits: 0, debits: 0 };
    const balance = Number(row.credits || 0) - Number(row.debits || 0);
    return sendSuccess(res, 200, { balance, currency: "PKR" });
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

async function listTransactions(req, res) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const rows = await WalletLedger.find({ userId: req.auth.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const data = rows.map((r) => ({
      id: r._id.toString(),
      amount: r.amount,
      type: r.type,
      description: r.description,
      provider: r.provider,
      status: r.status,
      externalId: r.externalId,
      createdAt: r.createdAt
    }));
    return sendSuccess(res, 200, data);
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

module.exports = { summary, listTransactions };
