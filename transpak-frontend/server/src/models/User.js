import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const documentSchema = new mongoose.Schema(
  {
    type: { type: String, trim: true },
    url: { type: String, trim: true },
    verified: { type: Boolean, default: false }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, index: true, sparse: true },
    phone: { type: String, trim: true, index: true, sparse: true },
    cnic: { type: String, trim: true, index: true, sparse: true },
    password: { type: String, required: true },
    roles: { type: [String], default: ['shipper', 'carrier'] },
    activeRole: { type: String, default: 'shipper' },
    documents: { type: [documentSchema], default: [] },
    verified: { type: Boolean, default: false },
    blocked: { type: Boolean, default: false }
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function matchPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

export const User = mongoose.model('User', userSchema);
