// inspect-drive/src/app/api/files/move/route.ts

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import File from "@/models/File";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/authOptions";
import path from "path";
import fs from "fs/promises";

// ฟังก์ชัน normalizePath: แทนที่ backslash ด้วย forward slash และ trim whitespace
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").trim();
}

export async function POST(req: NextRequest) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sourceId?: string; destinationPath?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sourceId, destinationPath } = body;
  if (!sourceId || destinationPath === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Normalize destination path
  const destPath = destinationPath ? normalizePath(destinationPath) : "";

  // หา record ของไฟล์/โฟลเดอร์จาก DB
  const fileRecord = await File.findById(sourceId);
  if (!fileRecord) {
    return NextResponse.json({ error: "File or folder not found" }, { status: 404 });
  }
  if (String(fileRecord.owner) !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized: Not the owner" }, { status: 403 });
  }

  // เปลี่ยนที่เก็บไฟล์เป็น private/uploads/<userId>
  const userUploadDir = path.join(process.cwd(), "private", "uploads", session.user.id);

  // คำนวณ oldFullPath จาก record (ใช้ folderPath กับ fileName)
  const normalizedFolderPath = fileRecord.folderPath ? normalizePath(fileRecord.folderPath) : "";
  const oldFullPath = normalizedFolderPath
    ? `${normalizedFolderPath}/${fileRecord.fileName}`
    : fileRecord.fileName;

  // คำนวณ newFullPath จาก destPath กับ fileName
  const newFullPath = destPath ? `${destPath}/${fileRecord.fileName}` : fileRecord.fileName;

  console.log("Old Full Path:", oldFullPath);
  console.log("New Full Path:", newFullPath);

  // หากไม่มีการเปลี่ยนแปลง ให้ส่งกลับข้อความว่าไม่มีการเปลี่ยนแปลง
  if (normalizePath(oldFullPath) === normalizePath(newFullPath)) {
    return NextResponse.json({ message: "No change in path" }, { status: 200 });
  }

  let responseMessage = "";

  if (fileRecord.fileType === "folder") {
    // ตรวจสอบกรณีย้าย folder เข้าไปในตัวมันเองหรือ subfolder
    if (
      normalizePath(newFullPath) === normalizePath(oldFullPath) ||
      normalizePath(newFullPath).startsWith(normalizePath(oldFullPath) + "/")
    ) {
      console.warn("Attempt to drop folder into itself (or its subfolder) detected.");
      return NextResponse.json({ error: "Cannot drop folder into itself" }, { status: 400 });
    }

    // สำหรับโฟลเดอร์: ตรวจสอบว่าปลายทางมีโฟลเดอร์ชื่อเดียวกันอยู่หรือไม่
    let finalNewFullPath = newFullPath;
    let finalNewAbsolutePath = path.join(userUploadDir, normalizePath(newFullPath));

    try {
      await fs.access(finalNewAbsolutePath);
      const directory = path.dirname(finalNewAbsolutePath);
      const baseName = fileRecord.fileName;
      let counter = 1;
      while (true) {
        const candidate = `${baseName}(${counter})`;
        const candidatePath = path.join(directory, candidate);
        try {
          await fs.access(candidatePath);
          counter++;
        } catch {
          finalNewFullPath = destPath ? `${destPath}/${candidate}` : candidate;
          finalNewAbsolutePath = candidatePath;
          break;
        }
      }
    } catch {
      // หากไม่พบโฟลเดอร์ซ้ำ ใช้ชื่อเดิมได้
    }

    // อัปเดต record ของ folder ที่ถูกย้าย โดยบังคับให้ updatedAt เปลี่ยน
    fileRecord.folderPath = path.dirname(finalNewFullPath) === "." ? "" : path.dirname(finalNewFullPath);
    fileRecord.fileName = path.basename(finalNewFullPath);
    fileRecord.filePath = `/api/files/download/${fileRecord._id}`;
    fileRecord.updatedAt = new Date();
    await fileRecord.save();

    // อัปเดต children records ของโฟลเดอร์ที่ถูกย้าย (ไฟล์และโฟลเดอร์ลูก)
    const oldNormalized = normalizePath(oldFullPath);
    const newNormalized = normalizePath(finalNewFullPath);
    console.log("Updating children for folder with old path:", oldNormalized);
    await File.updateMany(
      {
        owner: session.user.id,
        folderPath: { $regex: `^${oldNormalized}(\\/|$)` },
      },
      [
        {
          $set: {
            newFolderPath: {
              $replaceOne: {
                input: "$folderPath",
                find: oldNormalized,
                replacement: newNormalized,
              },
            },
          },
        },
        {
          $set: {
            folderPath: "$newFolderPath",
            filePath: {
              $concat: ["/api/files/download/", { $toString: "$_id" }],
            },
            updatedAt: new Date(), // อัปเดต updatedAt ของ children ให้เป็นเวลาปัจจุบัน
          },
        },
        { $unset: "newFolderPath" },
      ]
    );

    // ย้ายโฟลเดอร์จริงในระบบไฟล์
    const oldAbsolutePath = path.join(userUploadDir, oldNormalized);
    console.log("Renaming folder on filesystem from:", oldAbsolutePath, "to:", finalNewAbsolutePath);
    try {
      await fs.mkdir(path.dirname(finalNewAbsolutePath), { recursive: true });
      await fs.rename(oldAbsolutePath, finalNewAbsolutePath);
      console.log("Folder rename success");
    } catch (err: unknown) {
      console.error("Error moving folder on filesystem:", err);
      const errorMessage = err instanceof Error ? err.message : "Error moving folder on filesystem";
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
    responseMessage = "Folder and its children moved successfully";
  } else {
    // สำหรับไฟล์ทั่วไป: ตรวจสอบว่ามีไฟล์ซ้ำในปลายทางหรือไม่
    let finalFileName = fileRecord.fileName;
    let finalNewAbsolutePath = path.join(userUploadDir, normalizePath(newFullPath));

    try {
      await fs.access(finalNewAbsolutePath);
      const directory = path.dirname(finalNewAbsolutePath);
      const ext = path.extname(fileRecord.fileName);
      const baseName = path.basename(fileRecord.fileName, ext);
      let counter = 1;
      while (true) {
        const candidate = `${baseName}(${counter})${ext}`;
        const candidatePath = path.join(directory, candidate);
        try {
          await fs.access(candidatePath);
          counter++;
        } catch {
          finalFileName = candidate;
          finalNewAbsolutePath = candidatePath;
          break;
        }
      }
    } catch {
      // หากไม่มีไฟล์ซ้ำ ใช้ชื่อเดิมได้
    }

    // อัปเดต record ของไฟล์ โดยบังคับให้ updatedAt เปลี่ยน
    fileRecord.folderPath = destPath;
    if (finalFileName !== fileRecord.fileName) {
      fileRecord.fileName = finalFileName;
    }
    fileRecord.filePath = `/api/files/download/${fileRecord._id}`;
    fileRecord.updatedAt = new Date();
    await fileRecord.save();

    const oldAbsolutePath = path.join(userUploadDir, normalizePath(oldFullPath));
    console.log("Renaming file on filesystem from:", oldAbsolutePath, "to:", finalNewAbsolutePath);
    try {
      await fs.mkdir(path.dirname(finalNewAbsolutePath), { recursive: true });
      await fs.rename(oldAbsolutePath, finalNewAbsolutePath);
      console.log("File rename success");
    } catch (err: unknown) {
      console.error("Error moving file on filesystem:", err);
      const errorMessage = err instanceof Error ? err.message : "Error moving file on filesystem";
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
    responseMessage = "File moved successfully";
  }

  return NextResponse.json({ message: responseMessage, file: fileRecord }, { status: 200 });
}
