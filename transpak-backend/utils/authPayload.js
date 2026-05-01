function roleFlags(roles) {
  const r = Array.isArray(roles) ? roles : [];
  return {
    hasShipper: r.includes("shipper"),
    hasCarrier: r.includes("carrier")
  };
}

function authData(user, token) {
  const roles = user.roles || [];
  return {
    user: user.toAuthJSON(),
    token,
    roles: roleFlags(roles),
    currentRole: user.activeRole
  };
}

/** Login-only payload: minimal user + token (full profile from GET /auth/profile). */
function loginAuthData(user, token) {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const idStr = user._id.toString();
  return {
    token,
    user: {
      _id: idStr,
      email: user.email,
      roles,
      activeRole: user.activeRole
    },
    roles: roleFlags(roles),
    currentRole: user.activeRole
  };
}

function authDataNoToken(user) {
  const roles = user.roles || [];
  return {
    user: user.toAuthJSON(),
    roles: roleFlags(roles),
    currentRole: user.activeRole
  };
}

module.exports = { authData, authDataNoToken, loginAuthData, roleFlags };
