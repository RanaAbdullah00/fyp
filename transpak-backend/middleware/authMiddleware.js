const User = require("../models/User");
const { verifyToken } = require("../utils/jwt");

/**
 * Authenticate requests using Authorization: Bearer <token>.
 * Attaches `req.user` with the safe frontend shape.
 */
async function protect(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const [scheme, token] = auth.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    const decoded = verifyToken(token);
    const userId = decoded?.sub;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    req.user = user.toAuthJSON();
    req.auth = {
      userId: userId,
      roles: decoded.roles || user.roles,
      activeRole: decoded.activeRole || user.activeRole
    };

    return next();
  } catch (err) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }
}

/**
 * Optional role guard for multi-role users.
 * Usage: router.get(..., protect, requireRole("admin"), handler)
 */
function requireRole(role) {
  return (req, res, next) => {
    const roles = req.auth?.roles || req.user?.roles || [];
    if (!roles.includes(role)) {
      return res.status(403).json({
        error: "Forbidden"
      });
    }
    return next();
  };
}

function requireAnyRole(rolesList) {
  const required = Array.isArray(rolesList) ? rolesList : [];
  return (req, res, next) => {
    const roles = req.auth?.roles || req.user?.roles || [];
    if (!required.some((r) => roles.includes(r))) {
      return res.status(403).json({
        error: "Forbidden"
      });
    }
    return next();
  };
}

module.exports = {
  protect,
  requireRole,
  requireAnyRole
};

