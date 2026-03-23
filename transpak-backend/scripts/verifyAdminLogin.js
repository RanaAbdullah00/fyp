/**
 * Verify admin login. Run: node scripts/verifyAdminLogin.js
 * Requires backend to be running and DB connected.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/User");

const MONGO_URI = process.env.MONGO_URI;

async function main() {
  if (!MONGO_URI) {
    console.log("MONGO_URI not set. Backend uses in-memory DB - run backend first, then this script cannot connect.");
    console.log("Instead, restart the backend (npm start) and try login at http://localhost:5000");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  const u = await User.findOne({ email: "mrrajpoot.327@gmail.com" }).select("+passwordHash");
  if (!u) {
    console.log("Admin user NOT FOUND. Seed will run on backend startup.");
  } else {
    const ok = await bcrypt.compare("11221122", u.passwordHash);
    console.log("Admin exists. Password check:", ok ? "PASS" : "FAIL");
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
