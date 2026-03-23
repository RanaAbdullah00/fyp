import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roleType: { type: String, enum: ['shipper', 'carrier'], required: true },
    type: { type: String, required: true, trim: true }, // BID_RECEIVED, NEW_LOAD, PAYMENT...
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const Notification = mongoose.model('Notification', notificationSchema);
