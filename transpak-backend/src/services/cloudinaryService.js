const { cloudinary, ensureConfigured } = require("../../config/cloudinary");

function assertAllowedImageMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(m)) {
    throw Object.assign(new Error("Only JPG, PNG, or WebP images are allowed"), { statusCode: 400 });
  }
}

async function uploadImageFile({ filePath, mimeType, folder, publicIdPrefix }) {
  try {
    ensureConfigured();
  } catch {
    throw Object.assign(new Error("File storage is not configured"), { statusCode: 503 });
  }
  assertAllowedImageMime(mimeType);

  const options = {
    folder: folder || "transpak",
    resource_type: "image",
    use_filename: true,
    unique_filename: true
  };
  if (publicIdPrefix) options.public_id = `${publicIdPrefix}_${Date.now()}`;

  let result;
  try {
    result = await cloudinary.uploader.upload(filePath, options);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[cloudinary.upload]", err?.http_code || "", err?.message || err);
    throw Object.assign(new Error("File upload failed, please try again"), { statusCode: 503 });
  }
  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    format: result.format
  };
}

module.exports = {
  uploadImageFile
};
