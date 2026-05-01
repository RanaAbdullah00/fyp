const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || !String(secret).trim()) {
    throw new Error(
      "TransPak auth: JWT_SECRET is missing or empty. Set a strong JWT_SECRET in the server environment before starting the API."
    );
  }
  return String(secret).trim();
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || "7d";
}

/**
 * Sign a JWT for a user.
 * Payload includes roles[] and activeRole (current workspace role).
 */
function signToken(user) {
  const secret = getJwtSecret();
  const payload = {
    sub: user._id.toString(),
    roles: user.roles,
    activeRole: user.activeRole
  };

  return jwt.sign(payload, secret, {
    expiresIn: getJwtExpiresIn()
  });
}

/**
 * Verify and decode a JWT.
 */
function verifyToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
}

module.exports = {
  signToken,
  verifyToken
};

