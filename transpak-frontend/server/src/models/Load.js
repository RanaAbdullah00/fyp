import mongoose from 'mongoose';

const loadSchema = new mongoose.Schema(
  {
    shipperId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedCarrierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    origin: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    weight: { type: Number, required: true },
    type: { type: String, required: true, trim: true }, // truck/type
    price: { type: Number, required: true }, // expected price
    pickupDate: { type: Date, required: true },
    status: { type: String, enum: ['Pending', 'Active', 'Completed'], default: 'Pending', index: true }
  },
  { timestamps: true }
);

export const Load = mongoose.model('Load', loadSchema);
