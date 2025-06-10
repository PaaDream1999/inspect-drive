// inspect-drive/src/app/api/files/share/pin/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import SharedFile from "@/models/SharedFile";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/authOptions";
import mongoose from "mongoose";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await dbConnect();

  const { id } = await context.params;

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid sharedId" }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
  }

  const { isPinned } = body;
  if (typeof isPinned !== "boolean") {
    return NextResponse.json({ error: "Invalid isPinned value" }, { status: 400 });
  }

  try {
    const update = {
      isPinned,
      pinnedAt: isPinned ? new Date() : null, // บันทึกเวลาปักหมุดหาก isPinned เป็น true
    };
    const updatedSharedFile = await SharedFile.findByIdAndUpdate(id, update, { new: true });
    if (!updatedSharedFile) {
      return NextResponse.json({ error: "SharedFile not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Updated pin status", updatedSharedFile }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error updating pin status";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
