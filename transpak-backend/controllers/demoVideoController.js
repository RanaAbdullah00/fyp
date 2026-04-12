const path = require("path");
const fs = require("fs");
const DemoVideoMeta = require("../models/DemoVideoMeta");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const uploadsDir = path.join(__dirname, "..", "uploads");

async function getInfo(_req, res) {
  try {
    const meta = await DemoVideoMeta.findOne();
    if (!meta || !meta.storedFilename) {
      return sendSuccess(res, 200, { hasVideo: false, streamPath: null, mimeType: null });
    }
    return sendSuccess(res, 200, {
      hasVideo: true,
      streamPath: "/api/demo-video/stream",
      mimeType: meta.mimeType || "video/mp4"
    });
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

async function streamVideo(_req, res) {
  try {
    const meta = await DemoVideoMeta.findOne();
    if (!meta || !meta.storedFilename) return res.status(404).end("No demo video");
    const fp = path.join(uploadsDir, meta.storedFilename);
    if (!fs.existsSync(fp)) return res.status(404).end("File missing");
    res.setHeader("Content-Type", meta.mimeType || "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    fs.createReadStream(fp).pipe(res);
  } catch (err) {
    return res.status(500).end();
  }
}

async function adminUpload(req, res) {
  try {
    if (!req.file) return sendError(res, 400, "Video file is required");

    const meta = (await DemoVideoMeta.findOne()) || new DemoVideoMeta({});
    const prev = meta.storedFilename;
    meta.storedFilename = req.file.filename;
    meta.mimeType = req.file.mimetype || "video/mp4";
    meta.originalName = String(req.file.originalname || "").slice(0, 200);
    await meta.save();

    if (prev && prev !== req.file.filename) {
      const oldPath = path.join(uploadsDir, prev);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          /* ignore */
        }
      }
    }

    return sendSuccess(res, 200, { ok: true, filename: meta.storedFilename }, "Demo video updated");
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

module.exports = { getInfo, streamVideo, adminUpload };
