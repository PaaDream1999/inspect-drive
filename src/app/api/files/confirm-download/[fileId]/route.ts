// inspect-drive/src/app/api/files/confirm-download/[fileId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

import dbConnect from '@/lib/dbConnect';
import FileModel, { IFile } from '@/models/File';
import SharedFileModel from '@/models/SharedFile';
import logger from '@/lib/logger';

export const config = { runtime: 'nodejs' };

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ fileId: string }> }
): Promise<NextResponse> {
  const { fileId } = await context.params;
  logger.debug('[confirm-download] POST start', { fileId, url: req.url });

  // Connect to MongoDB
  try {
    await dbConnect();
    logger.debug('[confirm-download] Database connected');
  } catch (error) {
    logger.error('[confirm-download] DB connection error', error);
    return NextResponse.json(
      { error: 'DB connection error' },
      { status: 500 }
    );
  }

  // Parse encryption key
  const url = new URL(req.url);
  const keyHex = url.searchParams.get('key');
  if (!keyHex) {
    logger.warn('[confirm-download] Missing encryption key');
    return NextResponse.json(
      { error: 'Encryption key is required' },
      { status: 400 }
    );
  }

  // Fetch file metadata
  let fileRecord: IFile | null;
  try {
    fileRecord = await FileModel.findById(fileId).lean<IFile>();
    logger.debug(
      '[confirm-download] File metadata lookup',
      { found: Boolean(fileRecord) }
    );
  } catch (error) {
    logger.error('[confirm-download] Error fetching file metadata', error);
    return NextResponse.json(
      { error: 'Error fetching file metadata' },
      { status: 500 }
    );
  }

  if (!fileRecord) {
    logger.warn('[confirm-download] File not found', { fileId });
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    );
  }

  if (!fileRecord.isSecret) {
    logger.warn('[confirm-download] Attempt to confirm non-secret file', { fileId });
    return NextResponse.json(
      { error: 'Not a secret file' },
      { status: 400 }
    );
  }

  // Validate provided key
  const providedKey = Buffer.from(keyHex, 'hex');
  const providedHash = crypto.createHash('sha256').update(providedKey).digest('hex');
  if (providedHash !== fileRecord.secretDK?.dkHash) {
    logger.warn('[confirm-download] Invalid encryption key', { fileId });
    return NextResponse.json(
      { error: 'Invalid encryption key' },
      { status: 403 }
    );
  }

  // Delete file from disk
  const absolutePath = path.join(
    process.cwd(),
    'private',
    'uploads',
    String(fileRecord.owner),
    fileRecord.folderPath ?? '',
    fileRecord.fileName
  );
  logger.debug('[confirm-download] Computed absolute path', { absolutePath });
  try {
    await fs.unlink(absolutePath);
    logger.info('[confirm-download] Deleted file from disk', { absolutePath });
  } catch (error) {
    logger.warn('[confirm-download] File delete from disk failed', {
      absolutePath,
      error: (error as Error).message
    });
  }

  // Delete metadata records
  try {
    await SharedFileModel.deleteMany({ file: fileRecord._id });
    await FileModel.deleteOne({ _id: fileRecord._id });
    logger.info('[confirm-download] Deleted metadata records', { fileId });
  } catch (error) {
    logger.error('[confirm-download] Failed to delete metadata', error);
    return NextResponse.json(
      { error: 'Failed to delete metadata' },
      { status: 500 }
    );
  }

  // Delete DataKey from KMS
  try {
    const kmsUrl = process.env.KMS_URL;
    const dataKeyId = fileRecord.secretDK?.dataKeyId;
    if (kmsUrl && dataKeyId) {
      const res = await fetch(`${kmsUrl}/keys/${dataKeyId}`, { method: 'DELETE' });
      const body = await res.text();
      if (res.ok) {
        logger.info('[confirm-download] Deleted DataKey from KMS', { dataKeyId });
      } else if (body.toLowerCase().includes('not found')) {
        logger.info(
          '[confirm-download] DataKey not found in KMS; treated as deleted',
          { dataKeyId }
        );
      } else {
        logger.error('[confirm-download] KMS delete failed', {
          dataKeyId,
          status: res.status,
          body
        });
      }
    } else {
      logger.warn('[confirm-download] KMS_URL or dataKeyId missing; skipping DataKey deletion');
    }
  } catch (error) {
    logger.error('[confirm-download] Error deleting DataKey from KMS', error);
  }

  logger.info('[confirm-download] Confirmation complete', { fileId });
  return NextResponse.json(
    { message: 'File, metadata, and DataKey deleted successfully' },
    { status: 200 }
  );
}
