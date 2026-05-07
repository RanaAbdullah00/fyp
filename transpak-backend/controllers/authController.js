const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const { signToken } = require("../utils/jwt");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { authData, authDataNoToken, loginAuthData } = require("../utils/authPayload");
const userRepo = require("../repositories/userRepo");

const DEMO_FORCE_ADMIN_EMAIL = "mrabdullah0456@gmail.com";

function normalizeRolesAndActiveRole(user) {
  const allowed = userRepo.ALLOWED_ROLES;
  const raw = Array.isArray(user.roles) ? user.roles : [];
  const roles = [...new Set(raw.map((r) => String(r || "").trim().toLowerCase()).filter((r) => allowed.includes(r)))];
  if (!roles.length) return { ok: false };
  const activeRaw = user.activeRole != null ? String(user.activeRole).trim().toLowerCase() : "";
  const active = roles.includes(activeRaw) ? activeRaw : roles.includes("admin") ? "admin" : roles[0];
  return { ok: true, roles, activeRole: active };
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

  const { email, phone, CNIC, password, confirmPassword, role } = req.body;

  if (String(password) !== String(confirmPassword)) {
    return sendError(res, 400, "Passwords do not match");
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const phoneRaw = String(phone).trim();
  const normalizedPhone = phoneRaw.startsWith("+") ? phoneRaw : `+${phoneRaw}`;
  const normalizedCnic = String(CNIC).trim();
  const normalizedRole = String(role).trim().toLowerCase();

  const allowedRoles = userRepo.ALLOWED_ROLES;
  if (normalizedRole === "admin") {
    return sendError(res, 403, "Forbidden");
  }
  if (!allowedRoles.includes(normalizedRole)) {
    return sendError(res, 400, "Missing required fields");
  }

  const emailMatch = await userRepo.findByEmail(normalizedEmail);
  if (emailMatch) return sendError(res, 409, "Account already exists with this Email");
  const phoneMatch = await userRepo.findByPhone(normalizedPhone);
  if (phoneMatch) return sendError(res, 409, "Account already exists with this Phone");
  const cnicMatch = await userRepo.findByCnicNumber(normalizedCnic);
  if (cnicMatch) return sendError(res, 409, "Account already exists with this CNIC");

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(String(password), saltRounds);

  const user = await userRepo.createUser({
    email: normalizedEmail,
    passwordHash,
    roles: [normalizedRole],
    activeRole: normalizedRole,
    phone: normalizedPhone,
    cnicNumber: normalizedCnic
  });

  const token = signToken(user);
  return sendSuccess(res, 201, authData(user, token), "Account created");
}

async function login(req, res) {
  try {
    const maybeError = validationErrorResponse(req, res);
    if (maybeError) return maybeError;

    const { email, password, roleHint } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    const row = await userRepo.findRowByEmailWithPassword(normalizedEmail);
    if (!row) {
      return sendError(res, 401, "Invalid credentials");
    }

    if (row.blocked) {
      return sendError(res, 403, "Account is blocked");
    }

    const storedHash = row.password_hash;
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

    let authUser = userRepo.findByEmail(normalizedEmail);
    authUser = await authUser;
    if (!authUser) return sendError(res, 401, "Invalid credentials");

    if (normalizedEmail === DEMO_FORCE_ADMIN_EMAIL) {
      // Demo override handled at seed time; keep for compatibility.
    } else {
      const normalized = normalizeRolesAndActiveRole(authUser);
      if (!normalized.ok) {
        console.error("[auth.login] invalid or empty roles for user", normalizedEmail);
        return sendError(res, 403, "Account configuration error");
      }

      if (roleHint) {
        const hint = String(roleHint).trim().toLowerCase();
        const allowed = userRepo.ALLOWED_ROLES;
        if (allowed.includes(hint) && normalized.roles.includes(hint)) {
          authUser.activeRole = hint;
        } else {
          authUser.activeRole = normalized.activeRole;
        }
      } else {
        authUser.activeRole = normalized.activeRole;
      }
    }

    if (authUser.activeRole) {
      await userRepo.setActiveRole(authUser.id, authUser.activeRole);
    }

    const token = signToken(authUser);
    return sendSuccess(res, 200, loginAuthData(authUser, token), "Logged in");
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
  const user = await userRepo.findById(req.auth.userId);
  if (!user) return sendError(res, 401, "Unauthorized");
  return sendSuccess(res, 200, authDataNoToken(user), "OK");
}

async function updateActiveRole(req, res) {
  const { activeRole } = req.body || {};
  const allowed = userRepo.ALLOWED_ROLES;
  const next = String(activeRole || "").trim().toLowerCase();
  if (!allowed.includes(next)) {
    return sendError(res, 400, "Invalid role");
  }

  const user = await userRepo.findById(req.auth.userId);
  if (!user) return sendError(res, 401, "Unauthorized");
  if (!user.roles.includes(next)) {
    return sendError(res, 403, "Role not available for this account");
  }

  const updated = await userRepo.setActiveRole(req.auth.userId, next);
  if (!updated) return sendError(res, 500, "Role update failed");

  const token = signToken(updated);
  return sendSuccess(res, 200, authData(updated, token), "Role updated");
}

module.exports = {
  register,
  login,
  profile,
  updateActiveRole
};
