import crypto from "crypto";
import { ApiError } from "../utils/ApiError.js";

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

export const verifyGithubSignature = (req, res, next) => {
  const originalSignature = req.headers["x-hub-signature-256"];
  if (!originalSignature) return next(new ApiError(401, "Invalid signature"));
  const generatedSignature =
    "sha256=" +
    crypto
      .createHmac("sha256", GITHUB_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");
  const buf1 = Buffer.from(generatedSignature);
  const buf2 = Buffer.from(originalSignature);

  if (buf1.length !== buf2.length) {
    return next(new ApiError(401, "Invalid signature"));
  }

  if (!crypto.timingSafeEqual(buf1, buf2)) {
    return next(new ApiError(401, "Invalid Signature"));
  }

  next();
};
