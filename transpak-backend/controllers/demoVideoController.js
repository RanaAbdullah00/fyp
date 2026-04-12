const fs = require("fs");
const path = require("path");
const DemoVideoMeta = require("../models/DemoVideoMeta");
const { sendSuccess, sendError } = require("../utils/apiResponse");

const uploadsDir = path.join(__dirname, "..", "uploads");

async function getInfo(req, res) {
  try {
    const meta = await DemoVideoMeta.findOne();
    return sendSuccess(res, 200, {
      hasVideo: Boolean(meta?.storedFilename),
      mimeType: meta?.mimeType || null,
      streamPath: "/api/demo-video/stream"
    });
  } catch (err) {
    return sendError(res, 500, err.message || "Server error");
  }
}

async function streamVideo(req, res) {
  try {
    const meta = await DemoVideoMeta.findOne();
    if (!meta?.storedFilename) {
      return res.status(404).json({
        success: false,
        message: "No demo video uploaded",
        data: null
      });
    }
    const filePath = path.join(uploadsDir, meta.storedFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Video file missing", data: null });
    }
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const mime = meta.mimeType || "video/mp4";
    const range = req.headers.range;

    if (range) {
      const parts = String(range).replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (Number.isNaN(start) || start >= fileSize) {
        return res.status(416).end();
      }
      const safeEnd = Math.min(end, fileSize - 1);
      const chunkSize = safeEnd - start + 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${safeEnd}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mime
      });
      fs.createReadStream(filePath, { start, end: safeEnd }).pipe(res);
      return;
    }

    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": mime
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: err.message || "Stream error", data: null });
    }
  }
}

async function adminUpload(req, res) {
  try {
    if (!req.file) return sendError(res, 400, "No video file uploaded");
    const meta = (await DemoVideoMeta.findOne()) || new DemoVideoMeta({});
    meta.storedFilename = req.file.filename;
    meta.mimeType = req.file.mimetype || "video/mp4";
    await meta.save();
    return sendSuccess(res, 200, { ok: true, filename: meta.storedFilename });
  } catch (err) {
    return sendError(res, 500, err.message || "Upload failed");
  }
}

module.exports = { getInfo, streamVideo, adminUpload };
