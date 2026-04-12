const mongoose = require("mongoose");

/** Single official demo video (file under /uploads). */
const demoVideoMetaSchema = new mongoose.Schema(
  {
    storedFilename: { type: String, default: "" },
    mimeType: { type: String, default: "video/mp4" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("DemoVideoMeta", demoVideoMetaSchema);
