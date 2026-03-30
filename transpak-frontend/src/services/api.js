import axios from 'axios';

// Base Axios instance for all API calls.
// Point BASE_URL to your Express backend origin (e.g. http://localhost:5000/api).
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('transpak_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use((response) => {
  const body = response.data;
  if (body && typeof body.success === 'boolean' && 'data' in body) {
    return { ...response, data: body.data };
  }
  return response;
});

export default api;

