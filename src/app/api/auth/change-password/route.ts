// inspect-drive\src\app\api\auth\change-password\route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/authOptions";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import logger from "@/lib/logger";
import { validatePassword } from "@/lib/passwordUtils";

interface Body {
  currentPassword: string;
  newPassword: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { currentPassword, newPassword } = body;
  const err = validatePassword(newPassword);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const user = await User.findById(session.user.id).select("passwordHash");
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" }, { status: 400 });

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  logger.info("password changed", { userId: user.id });
  return NextResponse.json({ success: true });
}