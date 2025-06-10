// inspect-drive\src\app\api\auth\reset-password\route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import PasswordReset from "@/models/PasswordReset";
import { hashToken, validatePassword } from "@/lib/passwordUtils";
import logger from "@/lib/logger";

interface Body {
  uid: string;
  token: string;
  newPassword: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { uid, token, newPassword } = body;
  if (!uid || !token || !newPassword) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const err = validatePassword(newPassword);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  await dbConnect();
  const tokenHash = hashToken(token);
  const resetDoc = await PasswordReset.findOne({
    user: uid,
    tokenHash,
    expiresAt: { $gt: new Date() },
  });
  if (!resetDoc) return NextResponse.json({ error: "โทเคนไม่ถูกต้องหรือหมดอายุ" }, { status: 400 });

  const user = await User.findById(uid);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await Promise.all([user.save(), resetDoc.deleteOne()]);
  logger.info("password reset", { userId: uid });

  return NextResponse.json({ success: true });
}