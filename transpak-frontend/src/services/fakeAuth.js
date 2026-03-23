// Offline-only fake auth for FYP demo.
// Stores users in localStorage and simulates async latency.

const USERS_KEY = 'transpak_users';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const safeJsonParse = (raw, fallback) => {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

export function ensureDefaultUsers() {
  const existing = safeJsonParse(localStorage.getItem(USERS_KEY), []);

  const seeded = [
    {
      email: 'shipper@example.com',
      password: '123456',
      roles: ['shipper', 'carrier'],
      activeRole: 'shipper',
      cnic: '35202-1234567-1',
      phone: '+92 300 1234567',
      name: 'Demo Shipper'
    },
    {
      email: 'carrier@example.com',
      password: '123456',
      roles: ['shipper', 'carrier'],
      activeRole: 'carrier',
      cnic: '35202-7654321-2',
      phone: '+92 333 7654321',
      name: 'Demo Carrier'
    }
  ];

  // If users already exist, keep them but ensure demo accounts are always present.
  // This prevents "invalid credentials" when localStorage contains older/partial seed data.
  const list = Array.isArray(existing) ? existing : [];
  const byEmail = new Map(
    list
      .filter(Boolean)
      .map((u) => [String(u.email || '').trim().toLowerCase(), u])
      .filter(([email]) => Boolean(email)),
  );

  for (const demo of seeded) {
    const email = String(demo.email).trim().toLowerCase();
    const existingDemo = byEmail.get(email);
    // Guarantee demo credentials work even if localStorage was modified earlier.
    byEmail.set(email, {
      ...(existingDemo || {}),
      ...demo,
      email: demo.email,
      password: demo.password,
      roles: demo.roles,
      activeRole: existingDemo?.activeRole || demo.activeRole
    });
  }

  const merged = Array.from(byEmail.values());
  localStorage.setItem(USERS_KEY, JSON.stringify(merged));
  return merged;
}

export function getUsers() {
  return ensureDefaultUsers();
}

export async function registerFakeUser(payload) {
  await sleep(2000);

  const users = getUsers();
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email) throw new Error('Email is required');

  if (users.some((u) => String(u.email || '').toLowerCase() === email)) {
    throw new Error('User already exists');
  }

  const user = {
    email,
    password: String(payload.password || ''),
    roles: Array.isArray(payload.roles) && payload.roles.length ? payload.roles : ['shipper', 'carrier'],
    activeRole: payload.activeRole || 'shipper',
    cnic: payload.cnic || '',
    phone: payload.phone || '',
    name: payload.name || 'User'
  };

  localStorage.setItem(USERS_KEY, JSON.stringify([user, ...users]));
  return user;
}

export async function loginFakeUser({ email, password, roleHint }) {
  await sleep(2000);

  const users = getUsers();
  const e = String(email || '').trim().toLowerCase();
  const p = String(password || '');

  const user = users.find((u) => String(u.email || '').toLowerCase() === e);
  if (!user || String(user.password) !== p) {
    throw new Error('Invalid credentials');
  }

  const sessionUser = {
    ...user,
    activeRole: roleHint || user.activeRole || user.roles?.[0] || 'shipper'
  };
  localStorage.setItem('transpak_user', JSON.stringify(sessionUser));
  localStorage.setItem('transpak_token', `fake-jwt-${Date.now()}`);
  return sessionUser;
}

