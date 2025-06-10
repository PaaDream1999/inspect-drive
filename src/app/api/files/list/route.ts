// inspect-drive/src/app/api/files/list/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/authOptions';
import dbConnect from '@/lib/dbConnect';
import File from '@/models/File';
import { getFileIcon } from '@/utils/getFileIcon';

interface FileResponse {
  _id: string;
  fileName: string;
  folderPath?: string;
  fileType: string;
  updatedAt?: string;
  type: 'folder' | 'file';
  folderName?: string;
  filePath?: string;
  isSecret?: boolean;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  await dbConnect(); // เชื่อมต่อ MongoDB

  const session = await getServerSession(authOptions); // ตรวจสอบ session ของผู้ใช้
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); // ไม่ login
  }

  try {
    const userId = session.user.id;

    // ดึงไฟล์ทั้งหมดของผู้ใช้ เรียงตามอัปเดตล่าสุด
    const userFiles = await File.find({ owner: userId }).sort({ updatedAt: -1 });

    // ดึงพารามิเตอร์ "folder" จาก URL ถ้าไม่มีให้ใช้ ""
    const { searchParams } = new URL(req.url);
    const currentFolder = searchParams.get('folder') || '';

    const fileList: FileResponse[] = [];

    userFiles.forEach((f) => {
      const folderValue: string = f.folderPath || '';
      const fileType: string = f.fileType;

      // ใช้ .toJSON() เพื่อให้ schema ทำงาน transform (เช่น updatedAt เป็น ISO)
      const fileObj = f.toJSON();

      // ถ้าเป็นโฟลเดอร์และอยู่ใน currentFolder
      if (fileType === 'folder') {
        if (folderValue === currentFolder) {
          fileList.push({
            _id: fileObj._id,
            fileName: fileObj.fileName,
            folderPath: fileObj.folderPath,
            fileType: fileObj.fileType,
            updatedAt: fileObj.updatedAt,
            type: 'folder',
            folderName: fileObj.fileName,
            isSecret: fileObj.isSecret, // บอก client ว่าเป็นโฟลเดอร์ลับไหม
          });
        }
      } else {
        // ถ้าเป็นไฟล์และอยู่ใน currentFolder
        if (folderValue === currentFolder) {
          let finalFilePath = fileObj.filePath;

          // ถ้าเป็นรูปภาพลับให้แสดงไอคอนแทน path จริง
          if (fileType.startsWith('image/') && fileObj.isSecret) {
            finalFilePath = getFileIcon(fileType, true);
          }

          fileList.push({
            _id: fileObj._id,
            fileName: fileObj.fileName,
            folderPath: fileObj.folderPath,
            fileType: fileObj.fileType,
            updatedAt: fileObj.updatedAt,
            type: 'file',
            filePath: finalFilePath,
            isSecret: fileObj.isSecret, // บอก client ว่าเป็นไฟล์ลับไหม
          });
        }
      }
    });

    return NextResponse.json({ files: fileList }); // ส่งผลลัพธ์กลับ
  } catch (error) {
    // ถ้ามีข้อผิดพลาดในการดึงไฟล์
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Error fetching files' }, { status: 500 });
  }
}
