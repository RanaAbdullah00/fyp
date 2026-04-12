const mongoose = require("mongoose");

const appNotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    roleType: { type: String, trim: true, default: "" },
    read: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

appNotificationSchema.methods.toJSONSafe = function toJSONSafe() {
  return {
    id: this._id.toString(),
    _id: this._id.toString(),
    title: this.title,
    message: this.message,
    roleType: this.roleType,
    read: this.read,
    isRead: this.read,
    meta: this.meta,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model("AppNotification", appNotificationSchema);
