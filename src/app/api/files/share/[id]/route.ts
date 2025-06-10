// inspect-drive/src/app/api/files/share/[id]/route.ts

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import SharedFile, { ISharedFile } from '@/models/SharedFile';
import File, { IFile } from '@/models/File';
import { Types } from 'mongoose';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions';
import logger from '@/lib/logger';

/**
 * สร้าง JSON error response พร้อม log warning
 */
function jsonError(message: string, status = 400) {
  logger.warn(`JSON error: ${message}`, { status });
  return NextResponse.json({ error: message }, { status });
}

/**
 * GET /api/files/share/[id]
 * - ให้เจ้าของแชร์เข้าถึงได้ทุกกรณี
 * - ให้ผู้ใช้ที่ shareOption = public เข้าถึงได้โดยไม่ต้อง login
 * - ให้ผู้ใช้ที่ shareOption = department และอยู่ใน department เดียวกันเข้าถึงได้
 * - กรณี shareOption = private (นอกจากเจ้าของ) ห้ามเข้าถึง
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: shareId } = await context.params;
  logger.debug('GET /api/files/share/[id] - start', { shareId });

  // 1. เชื่อมต่อ DB
  await dbConnect();

  // 2. ตรวจสอบ format ของ shareId
  if (!Types.ObjectId.isValid(shareId)) {
    return jsonError('Invalid share ID', 400);
  }

  // 3. ดึงข้อมูล SharedFile พร้อม populate ข้อมูลไฟล์
  // - import IFile แทน any
  // - ใช้ populate<{ file: IFile }>() เพื่อกำหนด type ของ populated field
  // - lean<ISharedFile & { file: IFile | null }>() เพื่อระบุให้ doc.file เป็น IFile หรือ null
  const doc = await SharedFile.findById(shareId)
    .populate<{ file: IFile }>('file')
    .lean<ISharedFile & { file: IFile | null }>();

  if (!doc) {
    return jsonError('Share not found', 404);
  }

  // 4. Authorization logic
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // 4.1 เจ้าของแชร์เข้าถึงได้เสมอ
  if (String(doc.owner) === userId) {
    logger.debug('Owner accessing shared resource', { shareId, userId });
  }
  // 4.2 public share: ให้ทุกคนเข้าถึงได้
  else if (doc.shareOption === 'public') {
    logger.debug('Public share accessed', { shareId });
  }
  // 4.3 department share: ต้อง login และอยู่ใน sharedWithDepartments
  else if (doc.shareOption === 'department') {
    if (!session || !userId || !doc.sharedWithDepartments?.includes(userId)) {
      return jsonError('Unauthorized', 401);
    }
    logger.debug('Department share accessed', { shareId, userId });
  }
  // 4.4 private share นอกจากเจ้าของ: ห้ามเข้าถึง
  else {
    return jsonError('Unauthorized', 401);
  }

  // 5. สร้าง response object
  const sharedFile = {
    _id: String(doc._id),
    isFolder: doc.isFolder,
    folderPath: doc.folderPath,
    fullPath: doc.fullPath,
    shareOption: doc.shareOption,
    sharedWithDepartments: doc.sharedWithDepartments,
    owner: String(doc.owner),
    createdAt: doc.createdAt.toISOString(),
    file: doc.file
      ? {
          _id: String(doc.file._id),
          fileName: doc.file.fileName,
          fileType: doc.file.fileType,
          filePath: doc.file.filePath,
          owner: String(doc.file.owner),
          isSecret: !!doc.file.isSecret,
        }
      : null,
    isPinned: doc.isPinned,
    pinnedAt: doc.pinnedAt?.toISOString() ?? null,
  };

  logger.info('Shared file data retrieved', { shareId });
  return NextResponse.json({ sharedFile }, { status: 200 });
}

/**
 * DELETE /api/files/share/[id]
 * - ลบ record เดิม
 * - ถ้าแชร์เป็นไฟล์ ให้ unset ฟิลด์ shared ใน File model
 * - เฉพาะเจ้าของลิงก์เท่านั้นที่ลบได้
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: shareId } = await context.params;
  logger.debug('DELETE /api/files/share/[id] - start', { shareId });

  // 1. เชื่อมต่อ DB
  await dbConnect();

  // 2. ตรวจสอบ session, ต้อง login เท่านั้น
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return jsonError('Unauthorized', 401);
  }

  // 3. ตรวจสอบ format ของ shareId
  if (!Types.ObjectId.isValid(shareId)) {
    return jsonError('Invalid share ID', 400);
  }

  // 4. ดึง SharedFile จาก DB
  const shared = await SharedFile.findById(shareId);
  if (!shared) {
    return jsonError('Share not found', 404);
  }

  // 5. ตรวจสอบสิทธิ์: เฉพาะเจ้าของลิงก์เท่านั้น
  if (String(shared.owner) !== userId) {
    return jsonError('Forbidden', 403);
  }

  // 6. ถ้าแชร์เป็นไฟล์ ให้ cleanup ฟิลด์ shared ใน File model
  if (shared.file) {
    await File.findByIdAndUpdate(shared.file, { $unset: { shared: '' } });
  }

  // 7. ลบ document SharedFile
  await SharedFile.findByIdAndDelete(shareId);
  logger.info('Share link deleted', { shareId });

  return NextResponse.json(
    { message: 'Share link deleted successfully' },
    { status: 200 }
  );
}
