import api from './api.js';

// Auth-related API calls.
export const loginApi = (credentials) =>
  api.post('/auth/login', credentials);

export const registerApi = (payload) =>
  api.post('/auth/register', payload);

export const addRoleApi = (role) => api.post('/auth/add-role', { role });
