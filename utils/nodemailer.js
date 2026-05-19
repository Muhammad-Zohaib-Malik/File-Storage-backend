import nodemailer from "nodemailer";
import Otp from "../models/otp.model.js";

// 🔐 Utility to generate a 4-digit OTP
function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function sendOtp(email) {
  const otp = generateOtp();

  // Save or update OTP in DB
  await Otp.findOneAndUpdate(
    { email },
    { otp, createdAt: new Date() },
    { upsert: true, new: true }
  );

  // Beautiful HTML Email content
  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #f4f7fc; padding: 20px; border-radius: 8px; width: 100%; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #333; font-size: 24px; text-align: center;">Your OTP Code</h2>
        <p style="font-size: 16px; color: #555; text-align: center; margin-bottom: 20px;">Thank you for using Storage App. Please use the OTP below to verify your account:</p>
        <div style="background-color: #4CAF50; color: white; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; border-radius: 5px; margin-bottom: 20px;">
          ${otp}
        </div>
        <p style="font-size: 16px; color: #555; text-align: center;">This OTP is valid for the next 10 minutes. If you didn't request this, please ignore this email.</p>
        <div style="margin-top: 30px; text-align: center;">
          <p style="font-size: 14px; color: #aaa;">Best regards,</p>
          <p style="font-size: 14px; color: #aaa;">The Storage App Team</p>
        </div>
      </div>
    </div>
  `;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Send the email
  const info = await transporter.sendMail({
    from: `"Storage App" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Your OTP for Storage App",
    html,
  });

  return {
    success: true,
    message: "OTP sent successfully",
    messageId: info.messageId,
  };
}

export async function sendFileLink(email, fileUrl, fileName) {
  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #f4f7fc; padding: 20px; border-radius: 8px; width: 100%; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #333; font-size: 24px; text-align: center;">A File Has Been Shared with You</h2>
        <p style="font-size: 16px; color: #555; text-align: center; margin-bottom: 20px;">
          The file <strong>${fileName}</strong> has been shared with you.
        </p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${fileUrl}" style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; font-size: 18px; border-radius: 5px;">
            View File
          </a>
        </div>
        <p style="font-size: 14px; color: #555; text-align: center;">
          This link will expire in 1 hour. If you didn't expect this, please ignore this email.
        </p>
        <div style="margin-top: 30px; text-align: center;">
          <p style="font-size: 14px; color: #aaa;">Best regards,</p>
          <p style="font-size: 14px; color: #aaa;">The Storage App Team</p>
        </div>
      </div>
    </div>
  `;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Send the email
  const info = await transporter.sendMail({
    from: `"Storage App" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `File Shared ${fileName}`,
    html,
  });

  return {
    success: true,
    message: "File link sent successfully",
    messageId: info.messageId,
  };
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendDeploymentNotification({
  email,
  repoName,
  branchName,
  isSuccess,
  commit,
}) {
  const safeCommit = escapeHtml(commit);

  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              background-color: #f4f7fc;
              padding: 30px;">
    
    <div style="max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.08);
                overflow: hidden;">

      <!-- Header -->
      <div style="background: linear-gradient(135deg, #6366f1, #4f46e5);
                  padding: 20px 24px;
                  text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">
          🚀 Deployment Notification
        </h1>
      </div>

      <!-- Body -->
      <div style="padding: 24px;">

        <!-- Info Card -->
        <div style="background-color: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    padding: 16px;">

          <p style="margin: 8px 0; font-size: 15px; color: #374151;">
            <strong>Repository:</strong> ${repoName}
          </p>

          <p style="margin: 8px 0; font-size: 15px; color: #374151;">
            <strong>Branch:</strong> ${branchName}
          </p>

          <p style="margin: 12px 0 6px; font-size: 15px; color: #374151;">
            <strong>${isSuccess ? "Commit Message:" : "Error / Commit Details:"}</strong>
          </p>

          <pre style="
            margin: 0;
            padding: 14px;
            background-color: ${isSuccess ? "#ffffff" : "#fff1f2"};
            border-left: 4px solid ${isSuccess ? "#6366f1" : "#dc2626"};
            font-size: 13px;
            color: #374151;
            border-radius: 6px;
            white-space: pre-wrap;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">
${safeCommit}
          </pre>
        </div>

        <!-- Footer -->
        <div style="margin-top: 30px; text-align: center;">
          <p style="font-size: 13px; color: #9ca3af; margin: 4px 0;">
            This is an automated message from
          </p>
          <p style="font-size: 13px; color: #6b7280; margin: 0;">
            <strong>Storage App Deployment System</strong>
          </p>
        </div>

      </div>
    </div>
  </div>
  `;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: `"Storage App 🚀" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Deployment ${isSuccess ? "success" : "failed"} — ${repoName}`,
    html,
  });

  return { success: true, messageId: info.messageId };
}
