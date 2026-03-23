const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set in environment variables");
  return secret;
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || "7d";
}

/**
 * Sign a JWT for a user.
 * Payload includes role context for convenience.
 */
function signToken(user) {
  const payload = {
    sub: user._id.toString(),
    roles: user.roles,
    activeRole: user.activeRole
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getJwtExpiresIn()
  });
}

/**
 * Verify and decode a JWT.
 */
function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = {
  signToken,
  verifyToken
};

