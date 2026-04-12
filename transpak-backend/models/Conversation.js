const mongoose = require("mongoose");

/**
 * One conversation per (sorted participant pair) + optional load scope.
 * readAt: Map userId -> last read timestamp (minimal writes for "seen").
 */
const conversationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      }
    ],
    loadId: { type: mongoose.Schema.Types.ObjectId, ref: "Load", default: null },
    lastMessageAt: { type: Date, default: null },
    lastPreview: { type: String, default: "", maxlength: 200 },
    readAt: { type: Map, of: Date, default: () => new Map() }
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("Conversation", conversationSchema);
