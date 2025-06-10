// inspect-drive\src\app\api\files\pdf-preview\[fileId]\route.ts

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

import dbConnect from '@/lib/dbConnect';
import FileModel, { IFile } from '@/models/File';
import SharedFileModel, { ISharedFile } from '@/models/SharedFile';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions';
import logger from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ fileId: string }> }
): Promise<NextResponse> {
  const { fileId } = await context.params;
  logger.debug('[pdf-preview] GET start', { fileId, url: req.url });

  // 1) Connect to DB
  try {
    await dbConnect();
    logger.debug('[pdf-preview] Database connected');
  } catch (error) {
    logger.error('[pdf-preview] DB connection error', error);
    return NextResponse.json(
      { error: 'DB connection error' },
      { status: 500 }
    );
  }

  // 2) Fetch file record
  let fileRecord: IFile | null;
  try {
    fileRecord = await FileModel.findById(fileId).lean<IFile>();
    logger.debug('[pdf-preview] File lookup', { found: Boolean(fileRecord) });
  } catch (error) {
    logger.error('[pdf-preview] Error fetching file metadata', error);
    return NextResponse.json(
      { error: 'Error fetching file metadata' },
      { status: 500 }
    );
  }

  if (!fileRecord) {
    logger.warn('[pdf-preview] File not found in DB', { fileId });
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // 3) Try to fetch session (may fail or be null if not logged in)
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    logger.error('[pdf-preview] Session retrieval error', error);
  }

  const userId = session?.user?.id;
  const isOwner = userId === fileRecord.owner.toString();

  // 4) Fetch shared info if not owner
  let shared: ISharedFile | null = null;
  if (!isOwner) {
    try {
      shared = await SharedFileModel.findOne({ file: fileId }).lean<ISharedFile>();
      logger.debug('[pdf-preview] SharedFile lookup (non-owner)', { found: Boolean(shared) });
    } catch (error) {
      logger.error('[pdf-preview] Error fetching share info', error);
      return NextResponse.json(
        { error: 'Error fetching share info' },
        { status: 500 }
      );
    }

    if (!shared) {
      logger.warn('[pdf-preview] No share info for file (not owner)', { fileId });
      return NextResponse.json({ error: 'No share info' }, { status: 404 });
    }

    const { shareOption, owner, sharedWithDepartments = [] } = shared;
    logger.debug('[pdf-preview] Share metadata', {
      shareOption,
      owner: owner.toString(),
    });

    if (shareOption === 'public') {
      logger.debug('[pdf-preview] Public access allowed');
    } else if (!session?.user) {
      logger.warn('[pdf-preview] Unauthorized preview attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    } else if (shareOption === 'private') {
      logger.warn('[pdf-preview] Access denied: not owner', { userId });
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    } else if (
      shareOption === 'department' &&
      !sharedWithDepartments.includes(session.user.department!)
    ) {
      logger.warn('[pdf-preview] Access denied: department mismatch', {
        department: session.user.department,
      });
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    } else if (shareOption === 'secret') {
      logger.warn('[pdf-preview] Preview not allowed for secret files');
      return NextResponse.json({ error: 'Preview not allowed' }, { status: 403 });
    }
  } else {
    logger.debug('[pdf-preview] Owner access allowed (no share info needed)');
  }

  // 5) Serve PDF stream
  const absolutePath = path.join(
    process.cwd(),
    'private',
    'uploads',
    fileRecord.owner.toString(),
    fileRecord.folderPath || '',
    fileRecord.fileName
  );
  logger.debug('[pdf-preview] Computed file path', { absolutePath });

  try {
    await fs.access(absolutePath);
    const fileBuffer = await fs.readFile(absolutePath);
    logger.info('[pdf-preview] Serving PDF preview', { fileId });
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(
          fileRecord.fileName
        )}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    logger.warn('[pdf-preview] File not found on disk', {
      absolutePath,
      error: (error as Error).message,
    });
    return NextResponse.json(
      { error: 'File not found on disk' },
      { status: 404 }
    );
  }
}
