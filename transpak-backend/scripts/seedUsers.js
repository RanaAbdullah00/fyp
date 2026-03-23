require("dotenv").config();

const bcrypt = require("bcrypt");
const connectDB = require("../config/db");
const User = require("../models/User");

/**
 * Seeds a few default users for local development.
 * Run: npm run seed
 */
async function seed() {
  await connectDB();

  const password = process.env.SEED_PASSWORD || "Password123!";
  const passwordHash = await bcrypt.hash(password, 10);
  const adminPasswordHash = await bcrypt.hash("11221122", 10);

  const defaults = [
    {
      name: "Admin User",
      email: "mrrajpoot.327@gmail.com",
      phone: "+923001234567",
      cnic: "12345-1234567-0",
      roles: ["admin"],
      activeRole: "admin",
      verified: true,
      passwordHash: adminPasswordHash
    },
    {
      name: "Admin User (legacy)",
      email: "admin@transpak.com",
      phone: "+923000000001",
      cnic: "12345-1234567-1",
      roles: ["admin"],
      activeRole: "admin",
      verified: true
    },
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
      const pwd = u.passwordHash ? "11221122" : password;
      console.log(`Seeded: ${u.email} (password: ${pwd})`);
    } else {
      const existingWithHash = await User.findOne({ email: u.email }).select("+passwordHash");
      if (u.email === "mrrajpoot.327@gmail.com" && !existingWithHash?.passwordHash) {
        existingWithHash.passwordHash = adminPasswordHash;
        existingWithHash.roles = ["admin"];
        existingWithHash.activeRole = "admin";
        await existingWithHash.save();
        console.log(`Updated admin: ${u.email} (password: 11221122)`);
      } else {
        console.log(`Exists, skipped: ${u.email}`);
      }
    }
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

