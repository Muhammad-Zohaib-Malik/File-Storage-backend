import Directory from "../models/directoryModel.js";
import File from "../models/fileModel.js";
import Otp from "../models/otp.model.js";
import User from "../models/userModel.js";
import { verifyGoogleToken } from "../utils/googleAuth.js";
import { sendOtp } from "../utils/nodemailer.js";
import mongoose, { Types } from "mongoose";
import redisClient from "../config/redis.js";
import { rm } from "fs/promises";
import path from "path";
import { deleteS3FilesFromAws } from "../services/s3.js";
import {
  loginSchema,
  loginWithGoogleSchema,
  otpSchema,
  registerSchema,
  sendOtpSchema,
} from "../validators/userSchema.js";
import { z } from "zod/v4";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";
const window = new JSDOM("").window;
const purify = DOMPurify(window);
import { github } from "../utils/github.js";
import * as arctic from "arctic";
import { UAParser } from "ua-parser-js";
import { LoginActivity } from "../models/loginModel.js";
// import { getGeoLocation } from "../utils/getGeoLocation.js";

export const register = async (req, res, next) => {
  const { success, error, data } = registerSchema.safeParse(req.body);
  if (!success) {
    return res.status(400).json({ error: error.flatten().fieldErrors });
  }

  let { name, email, password, otp } = data;

  name = purify.sanitize(name);
  email = purify.sanitize(email);
  password = purify.sanitize(password);
  otp = purify.sanitize(otp);

  const otpRecord = await Otp.findOne({ email, otp });

  if (!otpRecord) {
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  await otpRecord.deleteOne();

  const session = await mongoose.startSession();

  try {
    const rootDirId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    session.startTransaction();

    await Directory.create(
      [
        {
          _id: rootDirId,
          name: `root-${email}`,
          parentDirId: null,
          userId,
        },
      ],
      { session }
    );

    await User.create(
      [
        {
          _id: userId,
          name,
          email,
          password,
          rootDirId,
          createdWith: "email",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: "User Registered Successfully" });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    if (err.code === 11000 && err.keyValue.email) {
      return res.status(409).json({
        error: "This email already exists",
        message:
          "A user with this email address already exists. Please try logging in or use a different email.",
      });
    }

    next(err);
  }
};

export const login = async (req, res) => {
  const { success, error, data } = loginSchema.safeParse(req.body);

  if (!success) {
    return res.status(400).json({ error: error.flatten().fieldErrors });
  }
  let { email, password } = data;

  email = purify.sanitize(email);
  password = purify.sanitize(password);

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ error: "Invalid Credentials" });
  }

  const passwordMatch = await user.isPasswordCorrect(password);
  if (!passwordMatch) {
    return res.status(404).json({ error: "Invalid Credentials" });
  }

  // const parser = new UAParser(req.headers["user-agent"]);
  // const uaResult = parser.getResult();
  // const location = await getGeoLocation();

  // await LoginActivity.create({
  //   userId: user._id,
  //   ip: location.ip,
  //   browser: uaResult.browser.name,
  //   os: uaResult.os.name,
  //   device: uaResult.device.model,
  //   city: location.city,
  //   country: location.country,
  // });

  const allSessions = await redisClient.ft.search(
    "userIdIdx",
    `@userId:{${user.id}}`,
    {
      RETURN: [],
    }
  );

  if (allSessions.documents.length >= 2) {
    await redisClient.del(allSessions.documents[0].id);
  }

  const sessionId = crypto.randomUUID();
  const redisKey = `session:${sessionId}`;
  await redisClient.json.set(redisKey, "$", {
    userId: user._id,
    rootDirId: user.rootDirId,
    role: user.role,
  });

  redisClient.expire(redisKey, 60 * 60 * 24 * 7);

  res.cookie("sid", sessionId, {
    httpOnly: true,
    signed: true,
    maxAge: 60 * 1000 * 60 * 24 * 7,
    sameSite: "lax",
  });
  res.json({ message: "Logged In" });
};

export const getCurrentUser = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized: User ID missing" });
    }

    const user = await User.findById(req.user._id).lean();
    const rootDir = await Directory.findById(user.rootDirId).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      name: user.name,
      email: user.email,
      picture: user.picture,
      role: user.role,
      maxStorageInBytes: user.maxStorageInBytes,
      createdWith: user.createdWith,
      usedStorageInBytes: rootDir.size,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const logout = async (req, res) => {
  const { sid } = req.signedCookies;
  await redisClient.del(`session:${sid}`);
  res.clearCookie("sid");
  res.status(204).end();
};

export const logoutFromAllDevices = async (req, res) => {
  const { sid } = req.signedCookies;
  const session = await redisClient.json.get(`session:${sid}`);
  const allSession = await redisClient.ft.search(
    "userIdIdx",
    `@userId:{${session.userId}}`,
    {
      RETURN: [],
    }
  );
  for (const session of allSession.documents) {
    await redisClient.del(session.id);
  }
  res.clearCookie("sid");

  res.status(204).end();
};

export const sendOTP = async (req, res) => {
  const { success, data } = sendOtpSchema.safeParse(req.body);
  if (!success) {
    return res.status(400).json({
      error: error.flatten().fieldErrors,
    });
  }

  let { email } = data;
  email = purify.sanitize(email);
  const resData = await sendOtp(email);
  res.json(resData);
};

export const verifyOTP = async (req, res) => {
  const { success, data } = otpSchema.safeParse(req.body);
  if (!success) {
    return res.status(400).json({ error: z.flattenError(error).fieldErrors });
  }

  try {
    let { email, otp } = data;
    email = purify.sanitize(email);
    otp = purify.sanitize(otp);
    const otpRecord = await Otp.findOne({ email, otp });

    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    res.json({ message: "OTP Verified successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

export const loginWithGoogle = async (req, res, next) => {
  const { success, data, error } = loginWithGoogleSchema.safeParse(req.body);
  if (!success) {
    return res.status(400).json({ error: error.flatten().fieldErrors });
  }

  const { code } = data;
  let mongooseSession;

  try {
    const userData = await verifyGoogleToken(code);
    const { email, name, picture } = userData;

    mongooseSession = await mongoose.startSession();
    mongooseSession.startTransaction();

    let user = await User.findOne({ email })
      .session(mongooseSession)
      .select("-__v");

    if (user && user.createdWith !== "google") {
      await mongooseSession.abortTransaction();
      return res.status(400).json({
        error: `User already exists with ${user.createdWith} method. Try to login with ${user.createdWith}`,
      });
    }

    if (user) {
      if (user.IsDeleted) {
        await mongooseSession.abortTransaction();
        return res.status(403).json({
          error: "Your account has been deleted. Contact App Owner to recover",
        });
      }

      // Limit sessions to max 2
      const allSessions = await redisClient.ft.search(
        "userIdIdx",
        `@userId:{${user._id}}`,
        { RETURN: [] }
      );

      if (allSessions.documents.length >= 2) {
        await redisClient.del(allSessions.documents[0].id);
      }

      // Update avatar if changed
      if (!user.picture.includes("googleusercontent")) {
        user.picture = picture;
        await user.save({ session: mongooseSession });
      }
    } else {
      // New user registration
      const rootDirId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      const directory = new Directory({
        _id: rootDirId,
        name: `root-${email}`,
        parentDirId: null,
        userId,
      });

      user = new User({
        _id: userId,
        name,
        email,
        picture,
        rootDirId,
        createdWith: "google",
      });

      await directory.save({ session: mongooseSession });
      await user.save({ session: mongooseSession });
    }

    await mongooseSession.commitTransaction();

    // Create session in Redis
    const sessionId = crypto.randomUUID();
    const redisKey = `session:${sessionId}`;

    await redisClient.json.set(redisKey, "$", {
      userId: user._id,
      rootDirId: user.rootDirId,
      role: user.role,
    });

    await redisClient.expire(redisKey, 60 * 60 * 24 * 7); // 7 days

    res.cookie("sid", sessionId, {
      httpOnly: true,
      signed: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      sameSite: "lax",
    });

    return res.status(user.isNew ? 201 : 200).json({
      message: user.isNew ? "Account created and logged In" : "Logged In",
      user,
    });
  } catch (err) {
    if (mongooseSession) {
      await mongooseSession.abortTransaction();
    }
    console.error("Google Login Error:", err);
    return next(err);
  } finally {
    if (mongooseSession) {
      mongooseSession.endSession();
    }
  }
};

export const loginWithGithub = async (req, res, next) => {
  const state = arctic.generateState();
  const scopes = ["read:user", "user:email"];
  const url = github.createAuthorizationURL(state, scopes);
  const cookieConfig = {
    httpOnly: true,
    sameSite: "lax",
  };
  res.cookie("github_oauth", state, cookieConfig);
  res.redirect(url.href);
};

export const githubLoginCallback = async (req, res, next) => {
  const { code, state } = req.query;
  const storedState = req.cookies.github_oauth;
  const clientUrl = process.env.CLIENT_URL1 || process.env.CLIENT_URL2;

  if (!code || !state || state !== storedState) {
    return res.redirect(`${clientUrl}/login?error=${encodeURIComponent("Invalid state or missing code")}`);
  }

  let mongooseSession;

  try {
    // Exchange code for access token
    const tokens = await github.validateAuthorizationCode(code);

    // Fetch GitHub user
    const githubUserResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    });

    if (!githubUserResponse.ok) {
      return res.redirect(`${clientUrl}/login?error=${encodeURIComponent("Failed to fetch user data from GitHub")}`);
    }

    let { name, login, email, avatar_url } = await githubUserResponse.json();
    name = name || login || (email ? email.split("@")[0] : "GitHub User");

    if (!email) {
      const emailResponse = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${tokens.accessToken()}` },
      });
      if (emailResponse.ok) {
        const emails = await emailResponse.json();
        const primaryEmail = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.primary);
        if (primaryEmail) {
          email = primaryEmail.email;
        }
      }
    }

    if (!email) {
      return res.redirect(`${clientUrl}/login?error=${encodeURIComponent("GitHub did not return an email")}`);
    }

    // Start transaction early so both existing and new user flows are covered
    mongooseSession = await mongoose.startSession();
    mongooseSession.startTransaction();

    let user = await User.findOne({ email })
      .session(mongooseSession)
      .select("-__v");

    if (user && user.createdWith !== "github") {
      await mongooseSession.abortTransaction();
      return res.redirect(`${clientUrl}/login?error=${encodeURIComponent(`User already exists with ${user.createdWith} method. Try to login with ${user.createdWith}`)}`);
    }

    if (user) {
      if (user.IsDeleted) {
        await mongooseSession.abortTransaction();
        return res.redirect(`${clientUrl}/login?error=${encodeURIComponent("Your account has been deleted. Contact support to recover it.")}`);
      }

      // Update avatar if changed
      if (user.picture !== avatar_url) {
        user.picture = avatar_url;
        await user.save({ session: mongooseSession });
      }
    } else {
      // Create new user
      const rootDirId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      const directory = new Directory({
        _id: rootDirId,
        name: `root-${email}`,
        parentDirId: null,
        userId,
      });

      user = new User({
        _id: userId,
        name,
        email,
        picture: avatar_url,
        rootDirId,
        createdWith: "github",
      });

      await directory.save({ session: mongooseSession });
      await user.save({ session: mongooseSession });
    }

    // Commit the DB changes
    await mongooseSession.commitTransaction();

    // Create session in Redis
    const sessionId = crypto.randomUUID();
    const redisKey = `session:${sessionId}`;

    await redisClient.json.set(redisKey, "$", {
      userId: user._id,
      rootDirId: user.rootDirId,
      role: user.role,
    });

    await redisClient.expire(redisKey, 60 * 60 * 24 * 7); // 7 days

    res.cookie("sid", sessionId, {
      httpOnly: true,
      signed: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      sameSite: "lax",
    });
    res.redirect(process.env.CLIENT_URL1 || process.env.CLIENT_URL2);
  } catch (error) {
    if (mongooseSession) {
      await mongooseSession.abortTransaction();
    }
    console.error("GitHub Login Error:", error);
    return res.redirect(`${clientUrl}/login?error=${encodeURIComponent("An error occurred during GitHub login")}`);
  } finally {
    if (mongooseSession) {
      mongooseSession.endSession();
    }
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const isOwner = req.user.role === "Owner";
    const query = isOwner ? {} : { IsDeleted: false };

    const users = await User.find(query)
      .select("_id name email IsDeleted role")
      .lean();

    let cursor = "0";
    let loggedInUserIds = new Set();

    do {
      const result = await redisClient.scan(cursor, {
        MATCH: "session:*",
        COUNT: 100,
      });

      cursor = result.cursor;

      for (const key of result.keys) {
        const session = await redisClient.json.get(key);
        if (session?.userId) {
          loggedInUserIds.add(session.userId.toString());
        }
      }
    } while (cursor !== "0");

    const usersWithStatus = users.map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email,
      isLoggedIn: loggedInUserIds.has(user._id.toString()),
      isDeleted: user.IsDeleted,
      role: user.role,
    }));

    res.status(200).json({ users: usersWithStatus });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const logoutUsingRole = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res
        .status(400)
        .json({ message: "Invalid or missing userId in URL." });
    }
    const allSessions = await redisClient.ft.search(
      "userIdIdx",
      `@userId:{${userId}}`,
      {
        RETURN: [],
      }
    );

    for (const session of allSessions.documents) {
      await redisClient.del(session.id);
    }

    res
      .status(200)
      .json({ message: "Logged out from all sessions successfully." });
  } catch (err) {
    next(err);
  }
};

export const deleteUsingRoleBySoftDelete = async (req, res, next) => {
  const { userId } = req.params;

  if (req.user._id.toString() === userId.toString()) {
    return res.status(403).json({ message: "You can't delete yourself." });
  }

  try {
    await User.findByIdAndUpdate(userId, {
      IsDeleted: true,
    });

    return res
      .status(200)
      .json({ message: "User and all related data deleted successfully." });
  } catch (err) {
    next(err);
  }
};

export const deleteUsingRoleByHardDelete = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { userId } = req.params;

    if (req.user._id.toString() === userId.toString()) {
      return res.status(403).json({ message: "You can't delete yourself." });
    }

    session.startTransaction();

    // Step 1: Delete files from AWS S3
    const userFiles = await File.find({ userId }).session(session);

    if (userFiles.length > 0) {
      const keys = userFiles.map((file) => ({ Key: `${file._id}${file.extension}` }));
      
      // AWS S3 DeleteObjectsCommand allows a maximum of 1000 objects per request
      const chunkSize = 1000;
      for (let i = 0; i < keys.length; i += chunkSize) {
        const chunk = keys.slice(i, i + chunkSize);
        try {
          await deleteS3FilesFromAws({ keys: chunk });
        } catch (err) {
          console.warn(`Could not delete files chunk from S3 for user: ${userId}`, err.message);
        }
      }
    }

    // Step 2: Delete related DB entries
    await File.deleteMany({ userId }).session(session);
    await Directory.deleteMany({ userId }).session(session);
    await User.deleteOne({ _id: userId }).session(session);

    // Step 3: Clear sessions from Redis
    const allSessions = await redisClient.ft.search(
      "userIdIdx",
      `@userId:{${userId}}`,
      { RETURN: [] }
    );

    for (const redisSession of allSessions.documents) {
      await redisClient.del(redisSession.id);
    }

    await session.commitTransaction();
    res.status(200).json("User Deleted successfully");
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

export const recoverUserById = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (req.user.role !== "Owner") {
      return res
        .status(403)
        .json({ message: "Only owners can recover users." });
    }

    if (req.user._id.toString() === userId.toString()) {
      return res.status(403).json({ message: "You can't recover yourself." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.IsDeleted === false) {
      return res.status(400).json({ message: "User is already active." });
    }

    user.IsDeleted = false;
    await user.save();

    return res
      .status(200)
      .json({ message: "User and all related data recover successfully." });
  } catch (error) {
    next(error);
  }
};

export const changeRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const ownerProvidedRole = ["Admin", "Manager"];

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    if (req.user._id.toString() === userId.toString()) {
      return res.status(403).json({ message: "You can't change your role." });
    }

    if (!ownerProvidedRole.includes(role)) {
      return res
        .status(400)
        .json({ message: "You have no permission to change this role." });
    }

    if (req.user.role === "Owner") {
      await User.findByIdAndUpdate(userId, { role }, { new: true });
      return res.status(200).json({ message: "Role updated by Owner." });
    }
    if (req.user.role === "Admin") {
      if (role === "Owner" || user.role === "Owner") {
        return res
          .status(403)
          .json({ message: "Admin cannot change Owner's role." });
      }
      await User.findByIdAndUpdate(userId, { role }, { new: true });
      return res.status(200).json({ message: "Role updated by Admin." });
    }

    return res
      .status(403)
      .json({ message: "You are not allowed to change roles." });
  } catch (error) {
    next(error);
  }
};

export const updatePassword = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    password = purify.sanitize(password);
    user.password = password;
    await user.save();

    return res.status(200).json({ message: "Password updated successfully." });
  } catch (error) {
    next(error);
  }
};

export const updateUsername = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let { name } = req.body;

    if (!name || name.length < 3) {
      return res.status(400).json({ error: "Name must be at least 3 characters long." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    name = purify.sanitize(name);
    user.name = name;
    await user.save();

    return res.status(200).json({ message: "Name updated successfully." });
  } catch (error) {
    next(error);
  }
}