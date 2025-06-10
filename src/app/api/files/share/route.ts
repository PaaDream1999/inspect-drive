// inspect-drive/src/app/api/files/share/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/authOptions'
import SharedFile, { ISharedFile } from '@/models/SharedFile'
import File, { IFile } from '@/models/File'
import logger from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ShareRequestBody {
  fileId?: string
  folderPath?: string
  shareOption: ISharedFile['shareOption']
  departments?: string[]
}

interface FileResponse {
  _id: string
  fileName: string
  fileType: string
  filePath?: string
  owner: string
  isSecret: boolean
}

interface SharedFileResponse {
  _id: string
  isFolder: boolean
  folderPath?: string
  shareOption: ISharedFile['shareOption']
  sharedWithDepartments?: string[]
  owner: string
  createdAt: string
  file: FileResponse | null
  isPinned?: boolean
  pinnedAt?: string | null
}

interface ShareResponse {
  message: string
  sharedFile: SharedFileResponse
  shareLink: string
  plaintextDK?: string
}

type SharedFileLean = ISharedFile & { file: IFile | null }

function jsonError(message: string, status = 400) {
  logger.warn(`JSON error: ${message}`, { status })
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Content-Type': 'application/json' } }
  )
}

function toSharedFileResponse(doc: SharedFileLean): SharedFileResponse {
  return {
    _id: String(doc._id),
    isFolder: doc.isFolder,
    folderPath: doc.folderPath,
    shareOption: doc.shareOption,
    sharedWithDepartments: doc.sharedWithDepartments,
    owner: String(doc.owner),
    createdAt: doc.createdAt.toISOString(),
    isPinned: doc.isPinned,
    pinnedAt: doc.pinnedAt ? doc.pinnedAt.toISOString() : null,
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
  }
}

export async function GET() {
  logger.debug('GET /api/files/share - start')
  await dbConnect()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    logger.warn('Unauthorized GET /api/files/share')
    return jsonError('Unauthorized', 401)
  }

  try {
    const docsRaw = await SharedFile.find({ owner: session.user.id })
      .populate('file')
      .lean<SharedFileLean[]>()
      .exec()

    const sharedFiles = docsRaw.map(toSharedFileResponse)
    logger.info(`Fetched ${sharedFiles.length} shared file(s) for user ${session.user.id}`)

    return NextResponse.json(
      { sharedFiles },
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    logger.error('Error fetching shared files', { error: err })
    return jsonError('เกิดข้อผิดพลาดในการดึงข้อมูล shared files', 500)
  }
}

export async function POST(req: NextRequest) {
  logger.debug('POST /api/files/share - start')
  await dbConnect()

  let body: ShareRequestBody
  try {
    body = (await req.json()) as ShareRequestBody
    logger.debug('Request body parsed', { body })
  } catch {
    return jsonError('Invalid JSON format')
  }

  const { fileId, folderPath, shareOption, departments } = body
  if (!shareOption || (!fileId && !folderPath)) {
    logger.warn('Missing required fields in share request', { body })
    return jsonError('Missing required fields')
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    logger.warn('Unauthorized POST /api/files/share')
    return jsonError('Unauthorized', 401)
  }

  try {
    let normalizedDepartments: string[] | undefined
    if (shareOption === 'department') {
      if (Array.isArray(departments) && departments.length > 0) {
        normalizedDepartments = departments
          .filter((id) => Types.ObjectId.isValid(id))
          .map(String)
        logger.debug('Normalized departments from request', { normalizedDepartments })
      } else {
        const rawDept = session.user.department
        if (typeof rawDept !== 'string' || !Types.ObjectId.isValid(rawDept)) {
          logger.warn('Invalid department information for sharing', { rawDept })
          return jsonError('Invalid department information for sharing')
        }
        normalizedDepartments = [rawDept]
        logger.debug('Defaulted normalizedDepartments to session department', { normalizedDepartments })
      }
    }

    const commonPayload: Pick<
      ISharedFile,
      'shareOption' | 'sharedWithDepartments' | 'owner'
    > = {
      shareOption,
      sharedWithDepartments: normalizedDepartments,
      owner: new Types.ObjectId(session.user.id),
    }

    let sharedDoc: ISharedFile | null
    let plaintextDK: string | undefined

    if (fileId) {
      logger.debug('Processing file share', { fileId })
      if (!Types.ObjectId.isValid(fileId)) {
        logger.warn('Invalid fileId format', { fileId })
        return jsonError('Invalid fileId format')
      }

      const fileData = await File.findById(fileId).lean<IFile>()
      if (!fileData) {
        logger.warn('File not found', { fileId })
        return jsonError('File not found', 404)
      }
      if (String(fileData.owner) !== session.user.id) {
        logger.warn('Access denied for sharing file', { fileId, owner: fileData.owner })
        return jsonError('Access denied', 403)
      }

      if (fileData.isSecret) {
        const kmsURL = process.env.KMS_URL
        if (!fileData.secretDK || !kmsURL) {
          logger.error('Missing KMS config or secretDK for secret file', { fileId })
          return jsonError('Missing KMS configuration or secretDK', 500)
        }

        logger.debug('Requesting plaintextDK from KMS', { kmsURL })
        const kmsRes = await fetch(`${kmsURL}/keys/decrypt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fileData.secretDK),
        })
        if (!kmsRes.ok) {
          logger.error('Failed to decrypt data key from KMS', { status: kmsRes.status })
          throw new Error('Failed to decrypt data key from KMS')
        }

        const result = (await kmsRes.json()) as { plaintextDK?: string }
        if (!result.plaintextDK) {
          logger.error('KMS did not return plaintextDK')
          throw new Error('KMS did not return plaintextDK')
        }
        plaintextDK = result.plaintextDK
        logger.debug('Obtained plaintextDK from KMS')
      }

      sharedDoc = await SharedFile.findOneAndUpdate(
        { file: new Types.ObjectId(fileId) },
        { ...commonPayload, file: new Types.ObjectId(fileId) },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      logger.info('Shared file upserted', { sharedId: sharedDoc?._id })
    } else {
      logger.debug('Processing folder share', { folderPath })
      const childFile = await File.findOne({
        owner: session.user.id,
        folderPath: { $regex: `(^|/)${folderPath}(/|$)` },
      })
        .sort({ folderPath: 1 })
        .lean<IFile>()

      let fullPath = folderPath!
      if (childFile?.folderPath) {
        const parts = childFile.folderPath.split('/')
        const idx = parts.indexOf(folderPath!)
        if (idx >= 0) {
          fullPath = parts.slice(0, idx + 1).join('/')
        }
      }
      logger.debug('Determined fullPath for folder share', { fullPath })

      sharedDoc = await SharedFile.findOneAndUpdate(
        { folderPath, owner: session.user.id },
        {
          ...commonPayload,
          folderPath: folderPath!,
          fullPath,
          isFolder: true,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      logger.info('Shared folder upserted', { sharedId: sharedDoc?._id })
    }

    if (!sharedDoc) {
      logger.error('Failed to share file/folder: no document returned')
      return jsonError('Failed to share file/folder', 500)
    }

    const origin = process.env.BASE_URL || req.nextUrl?.origin || 'http://31.97.66.79:3001';

    const response: ShareResponse = {
      message: 'แชร์เรียบร้อยแล้ว',
      sharedFile: toSharedFileResponse(
        sharedDoc.toObject({ getters: true }) as SharedFileLean
      ),
      shareLink: `${origin}/share/${sharedDoc._id}`,
      ...(plaintextDK && { plaintextDK }),
    }

    logger.info('Share response ready', {
      sharedId: sharedDoc._id,
      user: session.user.id,
    })
    return NextResponse.json(response, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    logger.error('Share error', { error: err })
    const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
    return jsonError(msg, 500)
  }
}
