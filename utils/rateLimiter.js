// import { rateLimit } from "express-rate-limit";
// import RedisStore from "rate-limit-redis";
// import redisClient from "../config/redis.js";

// const createRateLimiter = () =>
//   rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 100,
//     standardHeaders: "draft-8",
//     legacyHeaders: false,
//     store: new RedisStore({
//       sendCommand: (...args) => redisClient.sendCommand(args),
//       prefix: "rate_limit:",
//     }),
//     handler: (req, res, next, options) => {
//       res.status(options.statusCode).json({
//         success: false,
//         message: "Too many requests, please try again later.",
//       });
//     },
//   });

// export default createRateLimiter;
