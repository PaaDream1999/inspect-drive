// inspect-drive/src/app/api/files/delete-folder/route.ts

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import File from "@/models/File";
import SharedFile from "@/models/SharedFile";
import fs from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/authOptions";

// ตรวจสอบชื่อโฟลเดอร์ที่ปลอดภัย (no directory traversal)
function isInvalidFolderName(folderName: string): boolean {
  const normalized = path.normalize(folderName);
  return (
    normalized.startsWith("..") ||
    path.isAbsolute(normalized) ||
    normalized.split(path.sep).some(seg => seg === "." || seg === "..")
  );
}

// Escape special regex characters
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const folderName = searchParams.get("folderName");

    if (!folderName || isInvalidFolderName(folderName)) {
      return NextResponse.json({ error: "Invalid or missing folderName parameter" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const uploadDir = path.join(process.cwd(), "private", "uploads");
    const userFolderPath = path.join(uploadDir, userId);
    const folderAbsolutePath = path.join(userFolderPath, folderName);

    const relativePath = path.relative(userFolderPath, folderAbsolutePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
    }

    // ลบโฟลเดอร์จริงจากระบบไฟล์
    await fs.rm(folderAbsolutePath, { recursive: true, force: true });

    // สร้าง regex pattern สำหรับลบไฟล์/แชร์ที่เกี่ยวข้อง
    const folderRegexPattern = `^${escapeRegex(folderName)}(\/|$)`;

    // ค้นหาไฟล์ทั้งหมดในโฟลเดอร์และลูก ๆ
    const filesToDelete = await File.find({
      owner: userId,
      $expr: {
        $regexMatch: {
          input: {
            $cond: [
              { $eq: ["$folderPath", ""] },
              "$fileName",
              { $concat: ["$folderPath", "/", "$fileName"] }
            ]
          },
          regex: folderRegexPattern,
          options: "i"
        }
      }
    }).select('_id').lean();

    const fileIds = filesToDelete.map(f => f._id);

    // ลบเอกสารไฟล์จากฐานข้อมูล
    await File.deleteMany({ _id: { $in: fileIds } });

    // ลบ shared links ของโฟลเดอร์และลูกทั้งหมด โดยใช้ fullPath
    const sharedFoldersDeletion = await SharedFile.deleteMany({
      owner: userId,
      isFolder: true,
      fullPath: { $regex: folderRegexPattern, $options: "i" }
    });

    // ลบ shared links ของไฟล์ทั้งหมด
    const sharedFilesDeletion = await SharedFile.deleteMany({
      owner: userId,
      isFolder: false,
      file: { $in: fileIds }
    });

    return NextResponse.json(
      {
        message: "Folder, sub-folders, files and all associated share links deleted successfully",
        deletedCounts: {
          files: fileIds.length,
          folderShares: sharedFoldersDeletion.deletedCount,
          fileShares: sharedFilesDeletion.deletedCount
        }
      },
      { status: 200 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
