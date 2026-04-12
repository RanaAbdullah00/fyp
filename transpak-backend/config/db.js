const mongoose = require("mongoose");

/**
 * Connect to MongoDB via Mongoose.
 * Uses MONGO_URI from environment variables.
 */
async function connectDB() {
  const uri = process.env.MONGO_URI;
  mongoose.set("strictQuery", true);

  if (uri) {
    try {
      await mongoose.connect(uri);
      return mongoose.connection;
    } catch (err) {
      // In development, allow a fallback to an in-memory MongoDB instance
      if (process.env.NODE_ENV !== "development") throw err;
      console.warn(
        `Mongo connect failed (${err.message}). Falling back to in-memory MongoDB (dev only)...`
      );
    }
  } else if (process.env.NODE_ENV !== "development") {
    throw new Error("MONGO_URI is not set in environment variables");
  }

  try {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    const mongod = await MongoMemoryServer.create();
    const memUri = mongod.getUri();
    await mongoose.connect(memUri);
    console.warn("Connected to in-memory MongoDB. Data will reset on restart.");
    return mongoose.connection;
  } catch (err) {
    console.error("In-memory MongoDB startup failed:", err.message || err);
    throw err;
  }
}

module.exports = connectDB;

