import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api.js';
import { unwrapBody } from '../utils/unwrapApi.js';

export const AuthContext = createContext(null);

function mergeSession(apiData) {
  const user = apiData.user || apiData;
  const currentRole = apiData.currentRole ?? user.activeRole ?? user.role;
  const roles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role].filter(Boolean);
  const next = {
    ...user,
    roles,
    activeRole: currentRole
  };
  const hasShipper = roles.includes('shipper');
  const hasCarrier = roles.includes('carrier');
  next.hasShipper = Boolean(apiData.roles?.hasShipper ?? hasShipper);
  next.hasCarrier = Boolean(apiData.roles?.hasCarrier ?? hasCarrier);
  return next;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('transpak_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        const roles = Array.isArray(parsed.roles) && parsed.roles.length ? parsed.roles : [parsed.role].filter(Boolean);
        const activeRole = parsed.activeRole || parsed.role || roles?.[0] || null;
        setUser({ ...parsed, roles, activeRole });
      } catch {
        localStorage.removeItem('transpak_user');
      }
    }
    setLoading(false);
  }, []);

  const login = (apiData) => {
    const normalized = mergeSession(apiData);
    setUser(normalized);
    localStorage.setItem('transpak_user', JSON.stringify(normalized));
  };

  const setActiveRole = async (role) => {
    if (!user) throw new Error('Not authenticated');
    const nextRole = String(role || '').trim().toLowerCase();
    if (!nextRole) throw new Error('Invalid role');

    const prev = user;
    const optimistic = { ...user, activeRole: nextRole };
    setUser(optimistic);
    localStorage.setItem('transpak_user', JSON.stringify(optimistic));

    try {
      const res = await api.patch('/auth/active-role', { activeRole: nextRole });
      const data = unwrapBody(res.data);
      if (data.token) localStorage.setItem('transpak_token', data.token);
      login(data);
    } catch (err) {
      // Revert role if the backend update fails.
      setUser(prev);
      localStorage.setItem('transpak_user', JSON.stringify(prev));
      throw err;
    }
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
