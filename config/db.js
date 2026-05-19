import mongoose from "mongoose";
import logger from "../utils/logger.js";

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("Database Connected Successfully!");
    return mongoose.connection;
  } catch (err) {
    logger.error("Database Connection Failed!");
    logger.error(err.message);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  await mongoose.disconnect();
  logger.info("Database Disconnected!");
  process.exit(0);
});
