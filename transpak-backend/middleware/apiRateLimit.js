const rateLimit = require("express-rate-limit");

/** Global API rate limit (per IP). Tuned for FYP / small deployments. */
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 500),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later",
    data: null
  }
});

module.exports = { globalApiLimiter };
