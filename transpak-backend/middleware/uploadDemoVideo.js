const multer = require("multer");
const path = require("path");

const uploadsDir = path.join(__dirname, "..", "uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".mp4";
    const safe = [".mp4", ".webm", ".mov", ".mkv"].includes(ext) ? ext : ".mp4";
    cb(null, `official-demo${safe}`);
  }
});

function fileFilter(_req, file, cb) {
  if (!file.mimetype || !String(file.mimetype).startsWith("video/")) {
    return cb(new Error("Only video uploads are allowed"));
  }
  cb(null, true);
}

module.exports = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter
});
