// inspect-drive/src/app/api/files/download/[fileId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { getServerSession } from 'next-auth/next';

import dbConnect from '@/lib/dbConnect';
import FileModel, { IFile } from '@/models/File';
import SharedFileModel, { ISharedFile } from '@/models/SharedFile';
import { authOptions } from '@/app/api/auth/authOptions';
import logger from '@/lib/logger';

/** สร้าง path แบบปลอดภัย */
const buildAbsolutePath = (
  ownerId: string,
  folderPath: string | undefined,
  fileName: string
): string =>
  path.join(process.cwd(), 'private', 'uploads', ownerId, folderPath ?? '', fileName);

/** ตรวจสิทธิ์ตาม shareOption */
const isShareAllowed = (
  shared: ISharedFile,
  sessionUserId: string | null,
  sessionDept: string | null
): boolean => {
  switch (shared.shareOption) {
    case 'public':
      return true;
    case 'private':
      return shared.owner.toString() === sessionUserId;
    case 'department':
      return Boolean(
        sessionDept !== null && shared.sharedWithDepartments?.includes(sessionDept)
      );
    case 'secret':
      return true;
    default:
      return false;
  }
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ fileId: string }> }
): Promise<NextResponse> {
  const { fileId } = await context.params;
  logger.debug('[download] Start GET', { method: req.method, url: req.url, fileId });

  // ตรวจจับ IP ลูกข่าย
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  let rawIp = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : realIp ?? 'unknown';
  if (rawIp.startsWith('::ffff:')) {
    rawIp = rawIp.replace('::ffff:', '');
  }
  const clientIp = rawIp;
  logger.debug('[download] Client IP detected', clientIp);

  // 1) Connect DB
  try {
    await dbConnect();
    logger.debug('[download] Database connected');
  } catch (error) {
    logger.error('[download] DB connection error', error);
    return NextResponse.json({ error: 'DB connection error' }, { status: 500 });
  }

  // 2) Fetch file record
  let fileRecord: IFile | null;
  try {
    fileRecord = await FileModel.findById(fileId).lean<IFile>();
    logger.debug(
      '[download] File record lookup',
      fileRecord ? 'found' : 'not found'
    );
  } catch (error) {
    logger.error('[download] Error fetching file record', error);
    return NextResponse.json({ error: 'Error fetching file record' }, { status: 500 });
  }
  if (!fileRecord) {
    logger.warn('[download] File not found', fileId);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // 3) Session และสิทธิ์
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id ?? null;
  const sessionDept = session?.user?.department ?? null;
  logger.debug('[download] Session info', { sessionUserId, sessionDept });

  // 4) Fetch shared info
  let shared: ISharedFile | null;
  try {
    shared = await SharedFileModel.findOne({ file: fileId }).lean<ISharedFile>();
    logger.debug(
      '[download] SharedFile record',
      shared ? 'exists' : 'none'
    );
  } catch (error) {
    logger.error('[download] Error fetching share record', error);
    return NextResponse.json({ error: 'Error fetching share info' }, { status: 500 });
  }

  // 5) ตรวจสิทธิ์ access
  if (shared) {
    if (!isShareAllowed(shared, sessionUserId, sessionDept)) {
      logger.warn('[download] Access denied by shareOption', shared.shareOption);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  } else {
    if (!sessionUserId || sessionUserId !== fileRecord.owner.toString()) {
      logger.warn('[download] Access denied: not owner', { sessionUserId, owner: fileRecord.owner.toString() });
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  // 6) อ่านไฟล์จาก disk
  const absolutePath = buildAbsolutePath(
    fileRecord.owner.toString(),
    fileRecord.folderPath,
    fileRecord.fileName
  );
  logger.debug('[download] Absolute file path', absolutePath);

  let contentBuffer: Buffer;
  try {
    contentBuffer = await fs.readFile(absolutePath);
    logger.debug('[download] File read from disk');
  } catch (error) {
    logger.error('[download] File not found on disk', error);
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }

  // 7) ถอดรหัสถ้าเป็น secret
  if (shared?.shareOption === 'secret' && fileRecord.isSecret) {
    logger.debug('[download] Decryption required for secret file');
    const { searchParams } = new URL(req.url);
    const keyHex = searchParams.get('key');
    if (!keyHex) {
      logger.warn('[download] Missing encryption key');
      return NextResponse.json({ error: 'Encryption key required' }, { status: 400 });
    }
    const providedKey = Buffer.from(keyHex, 'hex');
    const providedHash = crypto.createHash('sha256').update(providedKey).digest('hex');
    if (providedHash !== fileRecord.secretDK?.dkHash) {
      logger.warn('[download] Invalid encryption key hash');
      return NextResponse.json({ error: 'Invalid encryption key' }, { status: 403 });
    }
    try {
      const iv = Buffer.from(fileRecord.secretDK.iv, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', providedKey, iv);
      contentBuffer = Buffer.concat([decipher.update(contentBuffer), decipher.final()]);
      logger.info('[download] Decryption successful');
    } catch (error) {
      logger.error('[download] Error during decryption', error);
      return NextResponse.json({ error: 'Error decrypting file' }, { status: 500 });
    }
  }

  // 8) ส่งไฟล์กลับ
  logger.info('[download] Sending file response', fileRecord.fileName);
  const response = new NextResponse(contentBuffer, {
    status: 200,
    headers: {
      'Content-Type': fileRecord.fileType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
        fileRecord.fileName
      )}`
    }
  });
  response.headers.set('X-Client-IP', clientIp);
  return response;
}
