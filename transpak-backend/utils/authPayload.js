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

function authDataNoToken(user) {
  const roles = user.roles || [];
  return {
    user: user.toAuthJSON(),
    roles: roleFlags(roles),
    currentRole: user.activeRole
  };
}

module.exports = { authData, authDataNoToken, roleFlags };
