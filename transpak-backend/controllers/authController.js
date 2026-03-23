const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");
const { sendSuccess, sendError } = require("../utils/apiResponse");

function validationErrorResponse(req, res) {
  const result = validationResult(req);
  if (result.isEmpty()) return null;

  const errors = result.array();
  return sendError(res, 400, errors[0]?.msg || "Validation error", {
    fields: errors.map((e) => e.path)
  });
}

/**
 * POST /api/auth/register
 */
async function register(req, res) {
  const maybeError = validationErrorResponse(req, res);
  if (maybeError) return maybeError;

  const { name, email, phone, CNIC, password, confirmPassword, role } = req.body;

  if (String(password) !== String(confirmPassword)) {
    return sendError(res, 400, "Passwords do not match");
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const phoneRaw = String(phone).trim();
  const normalizedPhone = phoneRaw.startsWith("+") ? phoneRaw : `+${phoneRaw}`;
  const normalizedCnic = String(CNIC).trim();
  const normalizedRole = String(role).trim().toLowerCase();

  const allowedRoles = User.ALLOWED_ROLES || ["shipper", "carrier", "admin"];
  if (!allowedRoles.includes(normalizedRole)) {
    return sendError(res, 400, "Missing required fields");
  }

  const identityMatch = await User.findOne({
    $or: [{ email: normalizedEmail }, { phone: normalizedPhone }, { cnic: normalizedCnic }]
  }).select("+passwordHash");

  if (identityMatch) {
    if (identityMatch.email === normalizedEmail && identityMatch.phone !== normalizedPhone) {
      return sendError(res, 409, "Account already exists with this Email");
    }
    if (identityMatch.phone === normalizedPhone && identityMatch.email !== normalizedEmail) {
      return sendError(res, 409, "Account already exists with this Phone");
    }
    if (identityMatch.cnic === normalizedCnic && identityMatch.email !== normalizedEmail) {
      return sendError(res, 409, "Account already exists with this CNIC");
    }
    if (
      identityMatch.email !== normalizedEmail ||
      identityMatch.phone !== normalizedPhone ||
      identityMatch.cnic !== normalizedCnic
    ) {
      if (identityMatch.email === normalizedEmail) return sendError(res, 409, "Account already exists with this Email");
      if (identityMatch.phone === normalizedPhone) return sendError(res, 409, "Account already exists with this Phone");
      if (identityMatch.cnic === normalizedCnic) return sendError(res, 409, "Account already exists with this CNIC");
      return sendError(res, 409, "Account already exists");
    }

    if (identityMatch.blocked) {
      return sendError(res, 403, "Account is blocked");
    }

    const ok = await bcrypt.compare(String(password), identityMatch.passwordHash);
    if (!ok) return sendError(res, 401, "Invalid credentials");

    if (!identityMatch.roles.includes(normalizedRole)) {
      identityMatch.roles = Array.from(new Set([...identityMatch.roles, normalizedRole]));
    }
    identityMatch.activeRole = normalizedRole;
    identityMatch.name = identityMatch.name || String(name).trim();
    await identityMatch.save();

    const token = signToken(identityMatch);
    return sendSuccess(res, 200, { token, user: identityMatch.toAuthJSON() }, "Registration complete");
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(String(password), saltRounds);

  let user;
  try {
    user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      cnic: normalizedCnic,
      passwordHash,
      roles: [normalizedRole],
      activeRole: normalizedRole,
      verified: false
    });
  } catch (err) {
    if (err && err.code === 11000 && err.keyPattern) {
      if (err.keyPattern.email) return sendError(res, 409, "Account already exists with this Email");
      if (err.keyPattern.phone) return sendError(res, 409, "Account already exists with this Phone");
      if (err.keyPattern.cnic) return sendError(res, 409, "Account already exists with this CNIC");
    }
    throw err;
  }

  const token = signToken(user);
  return sendSuccess(res, 201, { token, user: user.toAuthJSON() }, "Account created");
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  const maybeError = validationErrorResponse(req, res);
  if (maybeError) return maybeError;

  const { email, password, roleHint } = req.body;
  const normalizedEmail = String(email).trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");
  if (!user) {
    return sendError(res, 401, "Invalid credentials");
  }

  if (user.blocked) {
    return sendError(res, 403, "Account is blocked");
  }

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) {
    return sendError(res, 401, "Invalid credentials");
  }

  if (roleHint) {
    const hint = String(roleHint).trim().toLowerCase();
    if (user.roles.includes(hint)) {
      user.activeRole = hint;
      await user.save();
    }
  }

  const token = signToken(user);
  return sendSuccess(res, 200, { token, user: user.toAuthJSON() }, "Logged in");
}

/**
 * GET /api/auth/profile
 */
async function profile(req, res) {
  return sendSuccess(res, 200, { user: req.user }, "OK");
}

module.exports = {
  register,
  login,
  profile
};
