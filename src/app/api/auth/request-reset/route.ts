// inspect-drive\src\app\api\auth\request-reset\route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User, { IUser } from "@/models/User";
import PasswordReset from "@/models/PasswordReset";
import { hashToken } from "@/lib/passwordUtils";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";
import logger from "@/lib/logger";

interface Body {
  email: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email } = body;
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  await dbConnect();
  const user = await User.findOne<IUser>({ email }).exec();

  // Always return 200 to prevent user enumeration
  if (!user) return NextResponse.json({ success: true });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await PasswordReset.create({ user: user._id, tokenHash, expiresAt });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
  const resetLink = `${baseUrl}/reset-password?token=${rawToken}&uid=${user._id}`;

  // Send email asynchronously; don't block the response
  sendPasswordResetEmail(email, resetLink).catch((err) =>
    logger.error("sendResetEmail failed", { err })
  );

  logger.info("password reset requested", { userId: user._id });

  return NextResponse.json({ success: true });
}