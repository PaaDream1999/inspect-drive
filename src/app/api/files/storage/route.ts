// inspect-drive\src\app\api\files\storage\route.ts

import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import File from "@/models/File";
import User from "@/models/User";

export async function GET(req: Request) {
  try {
    await dbConnect();

    // ดึง query parameter "username"
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    if (!username) {
      return NextResponse.json({ error: "Missing username" }, { status: 400 });
    }

    // ค้นหา user ใน collection "User" ด้วย username
    const user = await User.findOne({ username });
    // ถ้าไม่เจอ user ให้ใช้ default quota 20GB
    if (!user) {
      const defaultQuotaGB = 20;
      const defaultQuotaBytes = defaultQuotaGB * 1024 * 1024 * 1024;
      return NextResponse.json({
        used: 0,
        storageQuota: defaultQuotaBytes,
        isFull: false,
      });
    }

    // ถ้าเจอ user แล้ว ใช้ storageQuota จาก user หรือ default 20GB
    const quotaGB = user.storageQuota || 20;
    const quotaBytes = quotaGB * 1024 * 1024 * 1024;

    // ดึง user._id ออกมาเป็น string (ในกรณีที่ใน File เก็บ owner เป็น string)
    const userIdString = user._id.toString();

    // ค้นหาไฟล์ทั้งหมดของผู้ใช้ด้วย userIdString
    const files = await File.find({ owner: userIdString });

    // คำนวณพื้นที่ที่ใช้ไป (bytes) จาก fileSize
    const used = files.reduce((acc, file) => acc + (file.fileSize || 0), 0);
    const isFull = used >= quotaBytes;

    return NextResponse.json({ used, storageQuota: quotaBytes, isFull });
  } catch (error) {
    console.error("Error fetching storage info:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}