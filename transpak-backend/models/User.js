const mongoose = require("mongoose");

const ALLOWED_ROLES = ["shipper", "carrier", "admin"];

const emailRegex =
  // Simple, practical email validation
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * User Schema
 * - Password is stored as a bcrypt hash in `passwordHash`
 * - `roles` supports multi-role users; `activeRole` is the currently selected role
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => emailRegex.test(v),
        message: "Invalid email format"
      }
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      unique: true,
      trim: true,
      validate: {
        validator: (v) => /^\+[1-9]\d{7,14}$/.test(String(v || "").trim()),
        message: "Phone must be a valid international number"
      }
    },
    cnic: {
      type: String,
      required: [true, "CNIC is required"],
      unique: true,
      trim: true,
      minlength: [5, "CNIC must be at least 5 characters"]
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
      select: false
    },
    roles: {
      type: [String],
      required: true,
      default: [],
      validate: {
        validator: (arr) =>
          Array.isArray(arr) &&
          arr.length > 0 &&
          arr.every((r) => ALLOWED_ROLES.includes(r)),
        message: `Roles must be one of: ${ALLOWED_ROLES.join(", ")}`
      }
    },
    activeRole: {
      type: String,
      required: true,
      enum: ALLOWED_ROLES
    },
    verified: {
      type: Boolean,
      default: false
    },
    blocked: {
      type: Boolean,
      default: false
    },
    address: {
      type: String,
      default: "",
      trim: true,
      maxlength: 240
    },
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500
    },
    profileImage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 250000
    },
    cnicFrontImage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 250000
    },
    cnicBackImage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 250000
    }
  },
  { timestamps: true }
);

userSchema.statics.ALLOWED_ROLES = ALLOWED_ROLES;

/**
 * Shape returned to frontend.
 * Never includes password hash or internal fields.
 */
userSchema.methods.toAuthJSON = function toAuthJSON() {
  const profileComplete =
    Boolean(this.name) &&
    Boolean(this.email) &&
    Boolean(this.phone) &&
    Boolean(this.cnic) &&
    Boolean(this.address) &&
    Boolean(this.cnicFrontImage) &&
    Boolean(this.cnicBackImage);
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    phone: this.phone,
    cnic: this.cnic,
    address: this.address || "",
    bio: this.bio || "",
    profileImage: this.profileImage || "",
    cnicFrontImage: this.cnicFrontImage || "",
    cnicBackImage: this.cnicBackImage || "",
    roles: this.roles,
    activeRole: this.activeRole,
    verified: this.verified,
    blocked: Boolean(this.blocked),
    profileComplete
  };
};

module.exports = mongoose.model("User", userSchema);

