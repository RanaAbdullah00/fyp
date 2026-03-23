import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema(
  {
    loadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Load', required: true, index: true },
    carrierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    price: { type: Number, required: true },
    eta: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending', index: true }
  },
  { timestamps: true }
);

bidSchema.index({ loadId: 1, carrierId: 1 }, { unique: true });

export const Bid = mongoose.model('Bid', bidSchema);
