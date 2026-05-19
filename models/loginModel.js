import mongoose from "mongoose";

const loginActivitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ip: { type: String },
    browser: { type: String },
    os: { type: String },
    device: { type: String },
    city: { type: String },
    country: { type: String },
    loginAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const LoginActivity = mongoose.model(
  "LoginActivity",
  loginActivitySchema
);
