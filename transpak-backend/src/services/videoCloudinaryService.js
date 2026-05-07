const { v2: cloudinary } = require("cloudinary");

function getCloudinaryConfigFromEnv() {
  const url = String(process.env.CLOUDINARY_URL || "").trim();
  if (url) return { cloudinaryUrl: url };
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary config missing. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET."
    );
  }
  return { cloudName, apiKey, apiSecret };
}

let _configured = false;

function ensureConfigured() {
  if (_configured) return;
  const cfg = getCloudinaryConfigFromEnv();
  if (cfg.cloudinaryUrl) {
    cloudinary.config({ cloudinary_url: cfg.cloudinaryUrl });
  } else {
    cloudinary.config({
      cloud_name: cfg.cloudName,
      api_key: cfg.apiKey,
      api_secret: cfg.apiSecret
    });
  }
  _configured = true;
}

function assertAllowedVideoMime(mime) {
  const m = String(mime || "").toLowerCase();
  // FYP scope: keep common web-safe formats only.
  if (!["video/mp4", "video/webm", "video/quicktime"].includes(m)) {
    throw Object.assign(new Error("Only MP4, WebM, or MOV videos are allowed"), { statusCode: 400 });
  }
}

async function uploadVideoFile({ filePath, mimeType, folder, publicIdPrefix }) {
  ensureConfigured();
  assertAllowedVideoMime(mimeType);

  const options = {
    folder: folder || "transpak",
    resource_type: "video",
    use_filename: true,
    unique_filename: true
  };
  if (publicIdPrefix) options.public_id = `${publicIdPrefix}_${Date.now()}`;

  const result = await cloudinary.uploader.upload(filePath, options);
  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes,
    format: result.format
  };
}

module.exports = {
  uploadVideoFile
};

