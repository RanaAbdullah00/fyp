const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true
    },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    /** Client-supplied id for idempotent send (optional). */
    clientMessageId: { type: String, trim: true, default: null, maxlength: 128 }
  },
  { timestamps: true }
);

chatMessageSchema.index({ conversationId: 1, createdAt: -1 });
chatMessageSchema.index(
  { conversationId: 1, clientMessageId: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
