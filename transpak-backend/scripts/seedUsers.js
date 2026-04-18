require("dotenv").config();

const bcrypt = require("bcrypt");
const connectDB = require("../config/db");
const User = require("../models/User");

/**
 * Seeds a few default users for local development.
 * Run: npm run seed
 */
async function seed() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Seeding is allowed only in development");
  }

  await connectDB();

  const password = String(process.env.SEED_PASSWORD || "").trim();
  if (!password) {
    throw new Error("SEED_PASSWORD is required");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const adminEmail = String(process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPhone = String(process.env.SEED_ADMIN_PHONE || "").trim();
  const adminCnic = String(process.env.SEED_ADMIN_CNIC || "").trim();
  const adminPassword = String(process.env.SEED_ADMIN_PASSWORD || "").trim();
  const adminPasswordHash = adminPassword ? await bcrypt.hash(adminPassword, 10) : null;

  const defaults = [
    ...(adminEmail && adminPhone && adminCnic && adminPasswordHash
      ? [
          {
            name: "Admin User",
            email: adminEmail,
            phone: adminPhone,
            cnic: adminCnic,
            roles: ["admin"],
            activeRole: "admin",
            verified: true,
            passwordHash: adminPasswordHash
          }
        ]
      : []),
    {
      name: "Shipper User",
      email: "shipper@transpak.com",
      phone: "+923000000002",
      cnic: "12345-1234567-2",
      roles: ["shipper"],
      activeRole: "shipper",
      verified: true
    },
    {
      name: "Carrier User",
      email: "carrier@transpak.com",
      phone: "+923000000003",
      cnic: "12345-1234567-3",
      roles: ["carrier"],
      activeRole: "carrier",
      verified: true
    }
  ];

  for (const u of defaults) {
    const exists = await User.findOne({ email: u.email });
    if (!exists) {
      const hash = u.passwordHash || passwordHash;
      const { passwordHash: _ph, ...rest } = u;
      await User.create({ ...rest, passwordHash: hash });
      const pwd = u.passwordHash ? "[from env]" : "[SEED_PASSWORD]";
      console.log(`Seeded: ${u.email} (password: ${pwd})`);
    } else {
      console.log(`Exists, skipped: ${u.email}`);
    }
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

