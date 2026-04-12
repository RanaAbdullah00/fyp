const mongoose = require("mongoose");

const walletLedgerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    provider: { type: String, trim: true, maxlength: 64, default: "" },
    externalId: { type: String, trim: true, maxlength: 128, default: "" },
    status: { type: String, trim: true, maxlength: 32, default: "success" },
    meta: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

walletLedgerSchema.index({ userId: 1, createdAt: -1 });
walletLedgerSchema.index({ userId: 1, externalId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("WalletLedger", walletLedgerSchema);
