// inspect-drive/src/app/api/files/delete/[fileId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import mongoose from 'mongoose';

import dbConnect from '@/lib/dbConnect';
import File from '@/models/File';
import SharedFile from '@/models/SharedFile';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions';
import logger from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ fileId: string }> }
): Promise<NextResponse> {
  const { fileId } = await context.params;
  logger.debug('DELETE /files/delete start', { fileId });

  try {
    // 1) Connect to DB
    await dbConnect();
    logger.debug('Database connected');

    // 2) Authenticate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn('Unauthorized delete attempt', { fileId });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // 3) Validate fileId
    if (!mongoose.isValidObjectId(fileId)) {
      logger.warn('Invalid file ID format', { fileId });
      return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
    }

    // 4) Fetch file record
    const file = await File.findOne({ _id: fileId, owner: userId });
    if (!file) {
      logger.warn('File not found or unauthorized', { fileId, userId });
      return NextResponse.json({ error: 'File not found or unauthorized' }, { status: 404 });
    }

    // 5) Prevent folder deletion here
    if (file.fileType === 'folder') {
      logger.info('Folder delete attempted via file endpoint', { fileId, userId });
      return NextResponse.json(
        { error: 'Use delete-folder endpoint for folders' },
        { status: 400 }
      );
    }

    // 6) Delete filesystem file
    const relativePath = file.folderPath
      ? path.join(file.folderPath, file.fileName)
      : file.fileName;
    const absolutePath = path.join(
      process.cwd(),
      'private',
      'uploads',
      userId,
      relativePath
    );
    logger.debug('Computed absolute file path', { absolutePath });
    try {
      await fs.unlink(absolutePath);
      logger.info('Filesystem file deleted', { absolutePath });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn('Filesystem delete failed or file not found', { absolutePath, error: errMsg });
    }

    // 7) Delete DB records
    await File.findByIdAndDelete(fileId);
    logger.info('Deleted file record from DB', { fileId });
    await SharedFile.deleteMany({ file: file._id });
    logger.info('Deleted associated shared file records', { fileId });

    // 8) Handle secret files: delete DataKey
    if (file.isSecret && file.secretDK) {
      const dataKeyId =
        file.secretDK.dataKeyId?.toString() ?? file.secretDK._id.toString();
      const kmsURL = process.env.KMS_URL;
      if (kmsURL) {
        try {
          const res = await fetch(`${kmsURL}/keys/${dataKeyId}`, { method: 'DELETE' });
          const body = await res.text();
          if (res.ok) {
            logger.info('DataKey deleted from KMS', { dataKeyId });
          } else if (body.toLowerCase().includes('not found')) {
            logger.info('DataKey not found in KMS; treating as deleted', { dataKeyId });
          } else {
            logger.error('KMS delete failed', { dataKeyId, status: res.status, body });
          }
        } catch (error) {
          logger.error('Error deleting DataKey from KMS', { dataKeyId, error });
        }
      } else {
        logger.warn('KMS_URL not configured; skipping DataKey deletion', { dataKeyId });
      }
    }

    logger.info('Deletion process completed', { fileId });
    return NextResponse.json(
      { message: 'File and its share link deleted successfully' },
      { status: 200 }
    );
  } catch (error: unknown) {
    logger.error('Unhandled error in DELETE /files/delete', { fileId, error });
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
