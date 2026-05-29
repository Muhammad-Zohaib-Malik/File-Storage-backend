import speakeasy from "speakeasy";
import QRCode from "qrcode";
import User from "../models/userModel.js";
import redisClient from "../config/redis.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

export const setupTotp = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const secret = speakeasy.generateSecret({
      name: `StoreMyFiles (${user.email})`,
      issuer: "StoreMyFiles",
      length: 20,
    });

    // Store secret temporarily (isMfaEnabled remains false until verified)
    user.mfaSecret = secret.base32;
    await user.save();

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.status(200).json(new ApiResponse(200, {
      secret: secret.base32, // Manual entry fallback
      qrCode: qrCodeUrl,
      otpauthUrl: secret.otpauth_url,
    }));
  } catch (err) {
    next(err);
  }
};

export const verify2fa = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new ApiError(400, "Token is required");
    }

    const user = await User.findById(req.user._id);

    if (!user || !user.mfaSecret) {
      throw new ApiError(400, "MFA setup not initiated");
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: "base32",
      token,
      window: 1,
    });

    if (!verified) {
      throw new ApiError(400, "Invalid token");
    }

    user.isMfaEnabled = true;
    await user.save();

    res.status(200).json(new ApiResponse(200, null, "2FA verified and enabled successfully"));
  } catch (err) {
    next(err);
  }
};

export const reset2fa = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    user.isMfaEnabled = false;
    user.mfaSecret = undefined;
    await user.save();

    res.status(200).json(new ApiResponse(200, null, "2FA has been disabled and reset"));
  } catch (err) {
    next(err);
  }
};

export const verifyTotpLogin = async (req, res, next) => {
  try {
    const { mfaToken, token } = req.body;

    if (!mfaToken || !token) {
      throw new ApiError(400, "MFA token and verification code are required");
    }

    // Retrieve the userId from the temporary MFA pending token
    const userId = await redisClient.get(`mfa_pending:${mfaToken}`);
    if (!userId) {
      throw new ApiError(401, "MFA session expired. Please log in again.");
    }

    const user = await User.findById(userId);
    if (!user || !user.isMfaEnabled || !user.mfaSecret) {
      throw new ApiError(400, "MFA is not configured for this user");
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: "base32",
      token,
      window: 1,
    });

    if (!verified) {
      throw new ApiError(400, "Invalid verification code");
    }

    // Delete the pending MFA token
    await redisClient.del(`mfa_pending:${mfaToken}`);

    // Limit sessions to max 2
    const allSessions = await redisClient.ft.search(
      "userIdIdx",
      `@userId:{${user.id}}`,
      { RETURN: [] },
    );

    if (allSessions.documents.length >= 2) {
      await redisClient.del(allSessions.documents[0].id);
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const redisKey = `session:${sessionId}`;
    await redisClient.json.set(redisKey, "$", {
      userId: user._id,
      rootDirId: user.rootDirId,
      role: user.role,
    });

    await redisClient.expire(redisKey, 60 * 60 * 24 * 7);

    res.cookie("sid", sessionId, {
      httpOnly: true,
      signed: true,
      maxAge: 60 * 1000 * 60 * 24 * 7,
      sameSite: "lax",
    });

    res.status(200).json(new ApiResponse(200, null, "Logged In"));
  } catch (err) {
    next(err);
  }
};
