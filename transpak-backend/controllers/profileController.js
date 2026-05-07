const { validationResult } = require("express-validator");
const { query } = require("../db/pool");
const userRepo = require("../repositories/userRepo");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { uploadImageFile } = require("../src/services/cloudinaryService");
const { cleanupUploadedFiles } = require("../middleware/uploadProfileImages");

const CNIC_REGEX = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$/;

function validationErrorResponse(req, res) {
  const result = validationResult(req);
  if (result.isEmpty()) return null;
  const errors = result.array();
  return sendError(res, 400, errors[0]?.msg || "Validation error", {
    fields: errors.map((e) => e.path)
  });
}

function computeProfileComplete(u) {
  return Boolean(u.fullName) && Boolean(u.phone) && Boolean(u.cnicNumber) && Boolean(u.cnicImage) && Boolean(u.profileImage);
}

async function getProfile(req, res) {
  const user = await userRepo.findById(req.auth.userId);
  if (!user) return sendError(res, 401, "Unauthorized");
  return sendSuccess(res, 200, {
    full_name: user.fullName,
    phone: user.phone,
    email: user.email,
    cnic_number: user.cnicNumber,
    cnic_image: user.cnicImage,
    profile_image: user.profileImage,
    is_profile_complete: user.isProfileComplete
  });
}

async function getProfileStatus(req, res) {
  const user = await userRepo.findById(req.auth.userId);
  if (!user) return sendError(res, 401, "Unauthorized");
  return sendSuccess(res, 200, { is_profile_complete: user.isProfileComplete });
}

async function updateProfile(req, res) {
  const maybeError = validationErrorResponse(req, res);
  if (maybeError) return maybeError;

  try {
    const user = await userRepo.findById(req.auth.userId);
    if (!user) return sendError(res, 401, "Unauthorized");

    const fullName = req.body?.full_name != null ? String(req.body.full_name).trim() : null;
    const phone = req.body?.phone != null ? String(req.body.phone).trim() : null;
    const cnic = req.body?.cnic_number != null ? String(req.body.cnic_number).trim() : null;

    const cnicImageFile = req.files?.cnic_image?.[0] || null;
    const profileImageFile = req.files?.profile_image?.[0] || null;

    const next = {
      full_name: fullName ?? user.fullName ?? null,
      phone: phone ?? user.phone ?? null,
      cnic_number: user.cnicNumber || null,
      cnic_image: user.cnicImage || null,
      profile_image: user.profileImage || null
    };

    if (cnic != null && cnic !== "") {
      if (!CNIC_REGEX.test(cnic)) return sendError(res, 400, "Invalid CNIC format");
      if (user.cnicNumber && user.cnicNumber !== cnic) {
        return sendError(res, 403, "CNIC cannot be edited after first save");
      }
      if (!user.cnicNumber) {
        if (!cnicImageFile && !user.cnicImage) {
          return sendError(res, 400, "CNIC image is required when saving CNIC");
        }
        next.cnic_number = cnic;
      }
    }

    if (cnicImageFile) {
      const uploaded = await uploadImageFile({
        filePath: cnicImageFile.path,
        mimeType: cnicImageFile.mimetype,
        folder: "transpak/cnic",
        publicIdPrefix: `cnic_${req.auth.userId}`
      });
      next.cnic_image = uploaded.url;
    }
    if (profileImageFile) {
      const uploaded = await uploadImageFile({
        filePath: profileImageFile.path,
        mimeType: profileImageFile.mimetype,
        folder: "transpak/profile",
        publicIdPrefix: `profile_${req.auth.userId}`
      });
      next.profile_image = uploaded.url;
    }

    const isComplete = computeProfileComplete({
      fullName: next.full_name,
      phone: next.phone,
      cnicNumber: next.cnic_number,
      cnicImage: next.cnic_image,
      profileImage: next.profile_image
    });

    const { rows } = await query(
      `UPDATE users
       SET full_name = $2,
           phone = $3,
           cnic_number = COALESCE(cnic_number, $4),
           cnic_image = $5,
           profile_image = $6,
           is_profile_complete = $7,
           updated_at = now()
       WHERE id = $1
       RETURNING id`,
      [req.auth.userId, next.full_name, next.phone, next.cnic_number, next.cnic_image, next.profile_image, isComplete]
    );

    const finalUser = await userRepo.findById(rows[0]?.id);
    return sendSuccess(
      res,
      200,
      {
        full_name: finalUser.fullName,
        phone: finalUser.phone,
        email: finalUser.email,
        cnic_number: finalUser.cnicNumber,
        cnic_image: finalUser.cnicImage,
        profile_image: finalUser.profileImage,
        is_profile_complete: finalUser.isProfileComplete
      },
      "Updated"
    );
  } finally {
    cleanupUploadedFiles(req);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getProfileStatus,
  CNIC_REGEX
};

