require("dotenv").config();

const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
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
const paymentRoutes = require("./routes/paymentRoutes");
const chatRoutes = require("./routes/chatRoutes");
const walletRoutes = require("./routes/walletRoutes");
const demoVideoRoutes = require("./routes/demoVideoRoutes");
const disputeRoutes = require("./routes/disputeRoutes");
const { globalApiLimiter } = require("./middleware/apiRateLimit");
const realtimeHub = require("./services/realtimeHub");
const registerSocketHandlers = require("./sockets");

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

const socketCorsOrigin = allowedOrigins === null ? true : allowedOrigins;

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

app.use("/api", globalApiLimiter);

// Routes
app.get("/api/health", (req, res) =>
  res.json({ success: true, message: "ok", data: { status: "ok" } })
);

app.use("/api/demo-video", demoVideoRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/shipments", shipmentRoutes);
app.use("/api/loads", loadRoutes);
app.use("/api/bids", bidRoutes);
app.use("/api/trucks", truckRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/disputes", disputeRoutes);

// Not found handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found", data: null });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";
  const safeMessage =
    isProd && status >= 500 ? "Server error" : err.message || "Server error";
  res.status(status).json({
    success: false,
    message: safeMessage,
    data: null
  });
});

const PORT = process.env.PORT || 5000;

function getDevSeedAdminConfig() {
  if (process.env.NODE_ENV !== "development") return null;
  const email = String(process.env.DEV_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.DEV_ADMIN_PASSWORD || "").trim();
  const phone = String(process.env.DEV_ADMIN_PHONE || "").trim();
  const cnic = String(process.env.DEV_ADMIN_CNIC || "").trim();
  if (!email || !password || !phone || !cnic) return null;
  return {
    name: String(process.env.DEV_ADMIN_NAME || "Admin User").trim() || "Admin User",
    email,
    password,
    phone,
    cnic
  };
}

async function seedAdminIfNeeded() {
  const cfg = getDevSeedAdminConfig();
  if (!cfg) return;
  try {
    const bcrypt = require("bcrypt");
    const User = require("./models/User");
    const passwordHash = await bcrypt.hash(cfg.password, 10);

    const existing = await User.findOne({ email: cfg.email }).select("+passwordHash");

    // Only create admin if missing — do not modify existing users on every restart.
    if (!existing) {
      await User.create({
        name: cfg.name,
        email: cfg.email,
        phone: cfg.phone,
        cnic: cfg.cnic,
        passwordHash,
        roles: ["admin"],
        activeRole: "admin",
        verified: true
      });
      console.log(`Admin seeded: ${cfg.email}`);
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
      const httpServer = http.createServer(app);
      const io = new Server(httpServer, {
        cors: {
          origin: socketCorsOrigin,
          credentials: true
        }
      });
      realtimeHub.setIO(io);
      registerSocketHandlers(io);

      httpServer.listen(port, () => {
        console.log(`TransPak backend (HTTP + Socket.io) on port ${port}`);
      });
      httpServer.on("error", (err) => {
        if (err && err.code === "EADDRINUSE" && attempt < maxAttempts) {
          console.warn(`Port ${port} already in use. Trying ${port + 1}...`);
          try {
            io.close();
            httpServer.close();
          } catch {
            // ignore
          }
          return tryListen(port + 1, attempt + 1);
        }
        console.error("Server listen failed:", err.message || err);
        process.exit(1);
      });
      return httpServer;
    };
    tryListen(basePort);
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();

