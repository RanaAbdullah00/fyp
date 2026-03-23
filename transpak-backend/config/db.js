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
      console.warn(`Mongo connect failed (${err.message}). Falling back to in-memory MongoDB...`);
    }
  } else if (process.env.NODE_ENV !== "development") {
    throw new Error("MONGO_URI is not set in environment variables");
  }

  const { MongoMemoryServer } = require("mongodb-memory-server");
  const mongod = await MongoMemoryServer.create();
  const memUri = mongod.getUri();
  await mongoose.connect(memUri);
  return mongoose.connection;
}

module.exports = connectDB;

