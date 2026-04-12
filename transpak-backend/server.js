require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const shipmentRoutes = require("./routes/shipmentRoutes");
const loadRoutes = require("./routes/loadRoutes");
const bidRoutes = require("./routes/bidRoutes");
const truckRoutes = require("./routes/truckRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const demoVideoRoutes = require("./routes/demoVideoRoutes");

const app = express();

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// If you deploy behind a proxy (Render/Heroku/Nginx), enable this so rate limiting & IPs work correctly.
app.set("trust proxy", 1);

// Security & parsing middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(mongoSanitize());

// CORS: allow typical Vite dev origins + optional CORS_ORIGIN (comma-separated)
const defaultDevOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174"
];
const envOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins =
  envOrigins.length > 0 ? [...new Set([...defaultDevOrigins, ...envOrigins])] : null;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!allowedOrigins) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true
  })
);

// Routes
app.get("/api/health", (req, res) =>
  res.json({ success: true, message: "ok", data: { status: "ok" } })
);

app.use("/api/demo-video", demoVideoRoutes);

// Dev-only: seed admin user into current DB (for in-memory MongoDB)
if (process.env.NODE_ENV === "development") {
  const bcrypt = require("bcrypt");
  const User = require("./models/User");
  app.get("/api/dev/env", (req, res) => {
    res.json({ nodeEnv: process.env.NODE_ENV });
  });
  app.post("/api/dev/seed", async (req, res) => {
    try {
      const hash = await bcrypt.hash("11221122", 10);
      let u = await User.findOne({ email: "mrrajpoot.327@gmail.com" }).select("+passwordHash");
      if (!u) {
        u = await User.create({
          name: "Admin User",
          email: "mrrajpoot.327@gmail.com",
          phone: "+923001234567",
          cnic: "12345-1234567-0",
          passwordHash: hash,
          roles: ["admin"],
          activeRole: "admin",
          verified: true
        });
      } else {
        const ok = await bcrypt.compare("11221122", u.passwordHash);
        if (!ok) u.passwordHash = hash;
        u.roles = Array.from(new Set([...(u.roles || []), "admin"]));
        u.activeRole = "admin";
        u.verified = u.verified ?? true;
        await u.save();
      }
      res.json({ ok: true, message: "Admin seeded (mrrajpoot.327@gmail.com / 11221122)" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dev-only debug to verify admin passwordHash + role consistency.
  // DO NOT expose passwordHash in responses.
  app.get("/api/dev/admin-debug", async (req, res) => {
    try {
      const adminEmail = "mrrajpoot.327@gmail.com";
      const adminPassword = "11221122";
      const normalizedEmail = String(adminEmail).trim().toLowerCase();

      const u = await User.findOne({ email: normalizedEmail }).select("+passwordHash");
      if (!u) return res.json({ ok: false, found: false });

      const ok = await bcrypt.compare(String(adminPassword), u.passwordHash);
      return res.json({
        ok: true,
        found: true,
        roles: u.roles,
        activeRole: u.activeRole,
        blocked: Boolean(u.blocked),
        passwordHashPresent: Boolean(u.passwordHash),
        passwordMatchesSeed: ok
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Dev-only presence check (does not select passwordHash).
  app.get("/api/dev/admin-presence", async (req, res) => {
    try {
      const adminEmail = "mrrajpoot.327@gmail.com";
      const normalizedEmail = String(adminEmail).trim().toLowerCase();
      const u = await User.findOne({ email: normalizedEmail });
      return res.json({
        ok: true,
        found: Boolean(u),
        roles: u?.roles || [],
        activeRole: u?.activeRole || null,
        blocked: Boolean(u?.blocked)
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Dev-only: enumerate potential duplicate admin records.
  app.get("/api/dev/admin-multi", async (req, res) => {
    try {
      const adminEmail = "mrrajpoot.327@gmail.com";
      const normalizedEmail = String(adminEmail).trim().toLowerCase();
      const adminPassword = "11221122";

      const list = await User.find({ email: normalizedEmail }).select("+passwordHash");
      const results = await Promise.all(
        list.map(async (u) => {
          const ok = await bcrypt.compare(String(adminPassword), u.passwordHash);
          return {
            id: u._id.toString(),
            roles: u.roles || [],
            activeRole: u.activeRole,
            blocked: Boolean(u.blocked),
            passwordMatchesSeed: ok
          };
        })
      );

      return res.json({
        ok: true,
        count: list.length,
        results
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Dev-only: run bcrypt.compare using the same inputs as login.
  app.post("/api/dev/login-compare", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const adminPassword = password;

      const u = await User.findOne({ email: normalizedEmail }).select("+passwordHash");
      if (!u) return res.json({ ok: false, found: false });

      const ok = await bcrypt.compare(String(adminPassword), u.passwordHash);
      return res.json({
        ok,
        found: true,
        roles: u.roles || [],
        activeRole: u.activeRole || null
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
}

app.use("/api/auth", authRoutes);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/loads", loadRoutes);
app.use("/api/bids", bidRoutes);
app.use("/api/trucks", truckRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);

// Not found handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found", data: null });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Server error",
    data: null
  });
});

const PORT = process.env.PORT || 5000;

async function seedAdminIfNeeded() {
  if (process.env.NODE_ENV === "production") return;
  try {
    const bcrypt = require("bcrypt");
    const User = require("./models/User");
    const adminEmail = "mrrajpoot.327@gmail.com";
    const adminPassword = "11221122";
    const normalizedEmail = adminEmail.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const existing = await User.findOne({ email: normalizedEmail }).select("+passwordHash");

    // Only create admin if missing — do not modify existing users on every restart.
    if (!existing) {
      await User.create({
        name: "Admin User",
        email: normalizedEmail,
        phone: "+923001234567",
        cnic: "12345-1234567-0",
        passwordHash,
        roles: ["admin"],
        activeRole: "admin",
        verified: true
      });
      console.log("Admin seeded: mrrajpoot.327@gmail.com / 11221122");
    }
  } catch (err) {
    console.warn("Seed admin skipped:", err.message);
  }
}

async function start() {
  try {
    await connectDB();
    await seedAdminIfNeeded();
    const basePort = Number(PORT) || 5000;
    const maxAttempts = 20;
    const tryListen = (port, attempt = 0) => {
      const server = app.listen(port, () => {
        console.log(`TransPak backend running on port ${port}`);
      });
      server.on("error", (err) => {
        if (err && err.code === "EADDRINUSE" && attempt < maxAttempts) {
          console.warn(`Port ${port} already in use. Trying ${port + 1}...`);
          return tryListen(port + 1, attempt + 1);
        }
        console.error("Server listen failed:", err.message || err);
        process.exit(1);
      });
      return server;
    };
    tryListen(basePort);
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();

