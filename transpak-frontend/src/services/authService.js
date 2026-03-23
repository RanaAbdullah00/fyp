import api from './api.js';
import { unwrapResponseData } from '../utils/unwrapApi.js';

// Auth-related API calls.
export const loginApi = (credentials) =>
  api.post('/auth/login', credentials);

export const registerApi = (payload) =>
  api.post('/auth/register', payload);

// -----------------------------
// Dummy auth fallback (FYP demo)
// -----------------------------
const DUMMY_USERS_KEY = 'transpak_dummy_users';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readDummyUsers = () => {
  try {
    const raw = localStorage.getItem(DUMMY_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeDummyUsers = (users) => {
  localStorage.setItem(DUMMY_USERS_KEY, JSON.stringify(users));
};

const normalizeUser = (u) => {
  const roles = Array.isArray(u.roles) && u.roles.length ? u.roles : [u.role].filter(Boolean);
  const activeRole = u.activeRole || u.role || roles[0] || 'shipper';
  return { ...u, roles, activeRole };
};

const buildDummyJwt = (user) => `dummy.${btoa(JSON.stringify({ id: user.id, roles: user.roles, t: Date.now() }))}.token`;

export const loginOrDummy = async ({ emailOrPhone, password, roleHint }) => {
  // Try real backend first
  try {
    const res = await loginApi({ email: emailOrPhone, password });
    const inner = unwrapResponseData(res) || {};
    return { mode: 'api', ...inner };
  } catch (err) {
    // Dummy fallback: allow known demo credentials or locally registered users
    await sleep(2200);

    const demoAccounts = [
      {
        id: 'demo_shipper',
        name: 'Demo Shipper',
        email: 'shipper@example.com',
        password: '123456',
        roles: ['shipper', 'carrier'],
        activeRole: 'shipper'
      },
      {
        id: 'demo_carrier',
        name: 'Demo Carrier',
        email: 'carrier@example.com',
        password: '123456',
        roles: ['shipper', 'carrier'],
        activeRole: 'carrier'
      }
    ];

    const users = [...demoAccounts, ...readDummyUsers()];
    const identifier = String(emailOrPhone || '').toLowerCase();
    const found = users.find((u) => String(u.email || '').toLowerCase() === identifier);
    if (!found || String(found.password) !== String(password)) {
      const message = err?.response?.data?.message || 'Invalid credentials';
      const e = new Error(message);
      e.isDummy = true;
      throw e;
    }

    const user = normalizeUser({ ...found, activeRole: found.activeRole || roleHint || 'shipper' });
    return { mode: 'dummy', token: buildDummyJwt(user), user };
  }
};

export const registerOrDummy = async (payload) => {
  // Try real backend first
  try {
    const res = await registerApi(payload);
    const inner = unwrapResponseData(res) || {};
    return { mode: 'api', ...inner };
  } catch {
    await sleep(2400);

    const users = readDummyUsers();
    const email = String(payload.email || '').toLowerCase();
    if (!email) throw new Error('Email is required');
    if (users.some((u) => String(u.email || '').toLowerCase() === email)) {
      throw new Error('User already exists');
    }

    const user = normalizeUser({
      id: `dummy_${Date.now()}`,
      name: payload.name,
      email,
      phone: payload.phone,
      cnic: payload.cnic,
      password: payload.password,
      roles: payload.roles || ['shipper', 'carrier'],
      activeRole: payload.activeRole || 'shipper',
      verified: false
    });

    writeDummyUsers([user, ...users]);
    return { mode: 'dummy', token: buildDummyJwt(user), user };
  }
};

