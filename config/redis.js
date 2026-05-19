import { createClient } from "redis";
import logger from "./../utils/logger.js";

const redisClient = await createClient({
  url: process.env.REDIS_URL,
  
});

redisClient.on("error", (err) => {
  logger.error("Redis Client Error", err);
  process.exit(1);
});

await redisClient.connect();
logger.info("Redis Client Connected Successfully");
export default redisClient;
