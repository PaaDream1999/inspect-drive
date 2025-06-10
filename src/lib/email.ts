// inspect-drive\src\lib\email.ts

import nodemailer from "nodemailer";
import { google } from "googleapis";

const {
  SMTP_USER,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
} = process.env;

const oauth2Client = new google.auth.OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  if (!SMTP_USER || !GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    console.info("[email] Gmail OAuth2 not configured, reset link:", resetLink);
    return;
  }

  const { token: accessToken } = await oauth2Client.getAccessToken();
  if (!accessToken) throw new Error("Unable to retrieve access token for Gmail");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: SMTP_USER,
      clientId: GMAIL_CLIENT_ID,
      clientSecret: GMAIL_CLIENT_SECRET,
      refreshToken: GMAIL_REFRESH_TOKEN,
      accessToken,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || SMTP_USER,
    to,
    subject: "Password reset request",
    html: `<p>คลิกลิงก์ต่อไปนี้เพื่อรีเซ็ตรหัสผ่านภายใน 15 นาที:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
  });
}