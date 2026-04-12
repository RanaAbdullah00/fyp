import api from './api.js';

export async function fetchDemoVideoInfo() {
  const res = await api.get('/demo-video/info');
  return res.data;
}
