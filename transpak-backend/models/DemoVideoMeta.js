const mongoose = require("mongoose");

/** Single official demo video metadata (file lives on disk under /uploads). */
const demoVideoMetaSchema = new mongoose.Schema(
  {
    storedFilename: { type: String, default: "" },
    mimeType: { type: String, default: "video/mp4" },
    originalName: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("DemoVideoMeta", demoVideoMetaSchema);
