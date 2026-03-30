const User = require("../models/User");
const { verifyToken } = require("../utils/jwt");
const { sendError } = require("../utils/apiResponse");

async function protect(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const [scheme, token] = auth.split(" ");

    if (scheme !== "Bearer" || !token) {
      return sendError(res, 401, "Unauthorized");
    }

    const decoded = verifyToken(token);
    const userId = decoded?.sub;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 401, "Unauthorized");
    }

    req.user = user.toAuthJSON();
    req.auth = {
      userId: user._id.toString(),
      roles: user.roles,
      activeRole: user.activeRole
    };

    return next();
  } catch (err) {
    return sendError(res, 401, "Unauthorized");
  }
}

function requireRole(role) {
  return (req, res, next) => {
    const roles = req.auth?.roles || req.user?.roles || [];
    if (!roles.includes(role)) {
      return sendError(res, 403, "Forbidden");
    }
    return next();
  };
}

function requireAnyRole(rolesList) {
  const required = Array.isArray(rolesList) ? rolesList : [];
  return (req, res, next) => {
    const roles = req.auth?.roles || req.user?.roles || [];
    if (!required.some((r) => roles.includes(r))) {
      return sendError(res, 403, "Forbidden");
    }
    return next();
  };
}

function requireActiveRole(...allowed) {
  const list = allowed.flat();
  return (req, res, next) => {
    const roles = req.auth?.roles || [];
    if (roles.includes("admin")) return next();
    const active = req.auth?.activeRole;
    if (list.includes(active)) return next();
    return sendError(res, 403, "Switch role to continue");
  };
}

module.exports = {
  protect,
  requireRole,
  requireAnyRole,
  requireActiveRole
};
