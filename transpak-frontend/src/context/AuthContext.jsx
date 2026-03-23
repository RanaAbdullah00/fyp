import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('transpak_user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      const roles = Array.isArray(parsed.roles) && parsed.roles.length ? parsed.roles : [parsed.role].filter(Boolean);
      const activeRole = parsed.activeRole || parsed.role || roles?.[0] || null;
      setUser({ ...parsed, roles, activeRole });
    }
    setLoading(false);
  }, []);

  const login = (userData) => {
    const roles = Array.isArray(userData.roles) && userData.roles.length ? userData.roles : [userData.role].filter(Boolean);
    const activeRole = userData.activeRole || userData.role || roles?.[0] || null;
    const normalized = { ...userData, roles, activeRole };
    setUser(normalized);
    localStorage.setItem('transpak_user', JSON.stringify(normalized));
  };

  const setActiveRole = (role) => {
    setUser((prev) => {
      if (!prev) return prev;
      const roles = Array.isArray(prev.roles) ? prev.roles : [];
      if (!roles.includes(role)) return prev;
      const next = { ...prev, activeRole: role };
      localStorage.setItem('transpak_user', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const role = user?.activeRole || user?.role || '';
    if (role) document.body.dataset.role = role;
    else delete document.body.dataset.role;
  }, [user?.activeRole, user?.role]);

  const logout = () => {
    setUser(null);
    localStorage.removeItem('transpak_user');
    localStorage.removeItem('transpak_token');
  };

  const value = {
    user,
    loading,
    login,
    setActiveRole,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

