import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name must be less than 100 characters"),

  email: z.string().email("Please enter a valid email"),

  password: z.string().min(6, "Password must be at least 6 characters"),

  otp: z.string().regex(/^\d{4}$/, "Please enter a valid 4 digit OTP"),
});

export const loginSchema = registerSchema.pick({
  email: true,
  password: true,
});

export const otpSchema = registerSchema.pick({
  email: true,
  otp: true,
});

export const sendOtpSchema = registerSchema.pick({
  email: true,
});

export const passwordForGoogleSchema = z.object({
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
});

export const loginWithGoogleSchema = z.object({
  code: z.string(),
});
