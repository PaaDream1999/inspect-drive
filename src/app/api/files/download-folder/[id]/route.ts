// inspect-drive/src/app/api/files/download-folder/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { Readable } from 'stream';
import archiver from 'archiver';
import mongoose from 'mongoose';

import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/dbConnect';
import SharedFileModel, { ISharedFile } from '@/models/SharedFile';
import FileModel, { IFile } from '@/models/File';
import { authOptions } from '@/app/api/auth/authOptions';
import logger from '@/lib/logger';

// Escape special regex characters
const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  logger.debug('[download-folder] GET start', { method: req.method, url: req.url, shareId: id });

  // Detect client IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  let rawIp = forwardedFor ? forwardedFor.split(',')[0].trim() : realIp ?? 'unknown';
  if (rawIp.startsWith('::ffff:')) rawIp = rawIp.replace('::ffff:', '');
  const clientIp = rawIp;
  logger.debug('[download-folder] Client IP detected', { clientIp });

  // 1) Connect to database
  try {
    await dbConnect();
    logger.debug('[download-folder] Database connected');
  } catch (error) {
    logger.error('[download-folder] DB connection error', error);
    return NextResponse.json({ error: 'DB connection error' }, { status: 500 });
  }

  // 2) Validate share ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.warn('[download-folder] Invalid share ID', { shareId: id });
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  // 3) Fetch SharedFile record
  let shared: ISharedFile | null;
  try {
    shared = await SharedFileModel.findById(id).lean<ISharedFile>();
    logger.debug('[download-folder] SharedFile lookup', { found: Boolean(shared) });
  } catch (error) {
    logger.error('[download-folder] Error fetching share info', error);
    return NextResponse.json({ error: 'Error fetching share info' }, { status: 500 });
  }
  if (!shared || !shared.isFolder) {
    logger.warn('[download-folder] Folder share not found or not a folder', { shareId: id });
    return NextResponse.json({ error: 'Folder share not found' }, { status: 404 });
  }

  const { shareOption, owner, folderPath, sharedWithDepartments = [] } = shared;
  logger.debug('[download-folder] Share metadata', { shareOption, owner: owner.toString() });

  // 4) Access control
  if (shareOption !== 'public') {
    const session = await getServerSession(authOptions);
    logger.debug('[download-folder] Session fetched', { hasUser: Boolean(session?.user) });
    if (!session?.user) {
      logger.warn('[download-folder] Redirect to login for non-public access');
      return NextResponse.redirect(new URL('/error/401', req.url));
    }
    if (shareOption === 'private' && owner.toString() !== session.user.id) {
      logger.warn('[download-folder] Access denied: not owner', { userId: session.user.id, owner: owner.toString() });
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (shareOption === 'department' && !sharedWithDepartments.includes(session.user.department!)) {
      logger.warn('[download-folder] Access denied: department mismatch', { department: session.user.department });
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (shareOption === 'secret') {
      logger.warn('[download-folder] Access denied: secret folder not allowed');
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  // 5) Normalize and validate base folder path
  const baseFolder = folderPath.replace(/^\/+|\/+$/g, '');
  logger.debug('[download-folder] Normalized baseFolder', { baseFolder });
  if (!baseFolder) {
    logger.warn('[download-folder] Invalid folder path', { folderPath });
    return NextResponse.json({ error: 'Invalid folder path' }, { status: 400 });
  }

  // 6) Query files in folder
  const regex = new RegExp(`(^|/)${escapeRegex(baseFolder)}(?:/.*)?$`, 'i');
  logger.debug('[download-folder] Regex for file lookup', { regex });

  let folderFiles: IFile[];
  try {
    folderFiles = await FileModel.find({
      owner: owner.toString(),
      $expr: {
        $regexMatch: {
          input: {
            $cond: [
              { $gt: [{ $strLenCP: '$folderPath' }, 0] },
              { $concat: ['$folderPath', '/', '$fileName'] },
              '$fileName'
            ]
          },
          regex
        }
      }
    }).lean<IFile[]>();
    logger.debug('[download-folder] Files found count', { count: folderFiles.length });
  } catch (error) {
    logger.error('[download-folder] Error querying files', error);
    return NextResponse.json({ error: 'Error querying files' }, { status: 500 });
  }
  if (folderFiles.length === 0) {
    logger.warn('[download-folder] No files in shared folder', { shareId: id });
    return NextResponse.json({ error: 'No files in folder' }, { status: 404 });
  }

  // 7) Create ZIP archive
  logger.info('[download-folder] Creating ZIP archive', { totalFiles: folderFiles.length });
  const archive = archiver('zip', { zlib: { level: 9 } });
  const passThrough = new Readable().wrap(archive);
  const rootDir = path.join(process.cwd(), 'private', 'uploads', owner.toString());
  let addedCount = 0;

  for (const file of folderFiles) {
    const relPath = file.folderPath ? `${file.folderPath}/${file.fileName}` : file.fileName;
    const absPath = path.join(rootDir, relPath);
    try {
      await fs.access(absPath);
      archive.file(absPath, { name: relPath });
      addedCount++;
      logger.debug('[download-folder] Added file to archive', { relPath });
    } catch {
      logger.warn('[download-folder] Skipped missing file', { relPath });
    }
  }

  if (addedCount === 0) {
    logger.warn('[download-folder] No valid files added to archive', { shareId: id });
    return NextResponse.json({ error: 'No valid files found' }, { status: 404 });
  }

  archive.finalize();
  logger.debug('[download-folder] Archive finalized');

  // 8) Send ZIP response
  logger.info('[download-folder] Sending ZIP response', { shareId: id, filesAdded: addedCount });
  const response = new NextResponse(Readable.toWeb(passThrough) as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${baseFolder}.zip"`,
      'X-Client-IP': clientIp
    }
  });
  return response;
}
