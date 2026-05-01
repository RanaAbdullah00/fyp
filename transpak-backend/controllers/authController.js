const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { authData, authDataNoToken, loginAuthData } = require("../utils/authPayload");

const DEMO_FORCE_ADMIN_EMAIL = "mrabdullah0456@gmail.com";

function normalizeRolesAndActiveRole(user) {
  const allowed = User.ALLOWED_ROLES || ["shipper", "carrier", "admin"];
  const raw = Array.isArray(user.roles) ? user.roles : [];
  const roles = [
    ...new Set(
      raw
        .map((r) => String(r || "").trim().toLowerCase())
        .filter((r) => allowed.includes(r))
    )
  ];
  if (!roles.length) {
    return { ok: false };
  }

  user.roles = roles;

  const activeRaw = user.activeRole != null ? String(user.activeRole).trim().toLowerCase() : "";
  let active = activeRaw;
  if (!allowed.includes(active) || !roles.includes(active)) {
    active = roles.includes("admin") ? "admin" : roles[0];
    user.activeRole = active;
  }

  return { ok: true };
}

function validationErrorResponse(req, res) {
  const result = validationResult(req);
  if (result.isEmpty()) return null;

  const errors = result.array();
  return sendError(res, 400, errors[0]?.msg || "Validation error", {
    fields: errors.map((e) => e.path)
  });
}

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
  if (normalizedRole === "admin") {
    return sendError(res, 403, "Forbidden");
  }
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
    return sendSuccess(res, 200, authData(identityMatch, token), "Registration complete");
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
  return sendSuccess(res, 201, authData(user, token), "Account created");
}

async function login(req, res) {
  try {
    const maybeError = validationErrorResponse(req, res);
    if (maybeError) return maybeError;

    const { email, password, roleHint } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash +password");
    if (!user) {
      return sendError(res, 401, "Invalid credentials");
    }

    if (user.blocked) {
      return sendError(res, 403, "Account is blocked");
    }

    const storedHash = user.passwordHash || user.password;
    if (!storedHash || typeof storedHash !== "string") {
      console.error("[auth.login] missing password hash for user", normalizedEmail);
      return sendError(res, 401, "Invalid credentials");
    }

    let passwordOk = false;
    try {
      passwordOk = await bcrypt.compare(String(password || ""), storedHash);
    } catch (bcryptErr) {
      console.error("[auth.login] bcrypt.compare failed — full error:", bcryptErr);
      return sendError(res, 401, "Invalid credentials");
    }
    if (!passwordOk) {
      return sendError(res, 401, "Invalid credentials");
    }

    if (normalizedEmail === DEMO_FORCE_ADMIN_EMAIL) {
      user.roles = ["admin", "shipper", "carrier"];
      user.activeRole = "admin";
    } else {
      if (!normalizeRolesAndActiveRole(user).ok) {
        console.error("[auth.login] invalid or empty roles for user", normalizedEmail);
        return sendError(res, 403, "Account configuration error");
      }

      if (roleHint) {
        const hint = String(roleHint).trim().toLowerCase();
        const allowed = User.ALLOWED_ROLES || ["shipper", "carrier", "admin"];
        if (allowed.includes(hint) && user.roles.includes(hint)) {
          user.activeRole = hint;
        }
      }

      if (!normalizeRolesAndActiveRole(user).ok) {
        console.error("[auth.login] role normalization failed after hint", normalizedEmail);
        return sendError(res, 403, "Account configuration error");
      }

      if (!user.roles.includes(user.activeRole)) {
        user.activeRole = user.roles[0];
      }
    }

    try {
      await user.save({ validateBeforeSave: false });
    } catch (saveErr) {
      console.error("[auth.login] user.save failed — full error:", saveErr);
      return res.status(500).json({
        success: false,
        message: "Login failed",
        error: saveErr.message || String(saveErr),
        data: null
      });
    }

    const token = signToken(user);
    return sendSuccess(res, 200, loginAuthData(user, token), "Logged in");
  } catch (err) {
    console.error("[auth.login] full error:", err);
    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: err.message || String(err),
      data: null
    });
  }
}

async function profile(req, res) {
  const user = await User.findById(req.auth.userId);
  if (!user) return sendError(res, 401, "Unauthorized");
  return sendSuccess(res, 200, authDataNoToken(user), "OK");
}

async function updateActiveRole(req, res) {
  const { activeRole } = req.body || {};
  const allowed = User.ALLOWED_ROLES || ["shipper", "carrier", "admin"];
  const next = String(activeRole || "").trim().toLowerCase();
  if (!allowed.includes(next)) {
    return sendError(res, 400, "Invalid role");
  }

  const user = await User.findById(req.auth.userId);
  if (!user) return sendError(res, 401, "Unauthorized");
  if (!user.roles.includes(next)) {
    return sendError(res, 403, "Role not available for this account");
  }

  user.activeRole = next;
  await user.save();

  const token = signToken(user);
  return sendSuccess(res, 200, authData(user, token), "Role updated");
}

module.exports = {
  register,
  login,
  profile,
  updateActiveRole
};
