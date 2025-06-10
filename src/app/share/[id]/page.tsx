// inspect-drive/src/app/share/[id]/page.tsx

import React from 'react'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import dbConnect from '@/lib/dbConnect'
import SharedFileModel, { ISharedFile } from '@/models/SharedFile'
import FileModel, { IFile } from '@/models/File'
import DepartmentModel from '@/models/Department'
import { authOptions } from '@/app/api/auth/authOptions'
import SharedFileContent from '@/components/Share/SharedFileContent'
import DownloadButton from '@/components/Share/DownloadButton'
import { TYPE_LABELS, labelFromMime } from '@/utils/fileLabels'
import { Types } from 'mongoose'
import { CloudDownload } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const SHARE_OPTION_LABELS = {
  public: 'สาธารณะ',
  private: 'ส่วนตัว',
  department: 'แผนก/กอง',
  secret: 'ลับ',
} as const

type FileDoc = IFile & { isFolder: boolean }

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SharedFilePage({ params }: PageProps) {
  // 1. รับ id, trim, validate
  const { id: rawId } = await params
  const id = rawId.trim()
  if (!Types.ObjectId.isValid(id)) return notFound()

  // 2. เชื่อมต่อฐานข้อมูล
  await dbConnect()

  // 3. โหลดข้อมูล shared record
  const shared = await SharedFileModel.findById(id).lean<ISharedFile>()
  if (!shared) return notFound()

  const {
    shareOption,
    isFolder,
    file: fileId,
    fullPath,
    createdAt,
    sharedWithDepartments = [],
    owner: ownerId,
    folderPath,
  } = shared

  // 4. ถ้าไม่ใช่ public ต้อง login
  let session = null
  if (shareOption !== 'public') {
    session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      redirect('/login')
    }
  }
  const userId = session?.user?.id

  // 5. เช็คสิทธิ์
  const isOwner = userId === String(ownerId)
  if (!isOwner) {
    if (shareOption === 'public') {
      // ใครก็เข้าถึงได้
    } else if (shareOption === 'department') {
      const userDept = session!.user.department
      if (!userDept || !sharedWithDepartments.includes(userDept)) {
        return redirect('/error/401')
      }
    } else {
      // private หรือ secret นอกจากเจ้าของห้ามเข้าถึง
      return redirect('/error/401')
    }
  }

  // 6. ฟอร์แมตรูปวันที่
  const formattedDate = new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(createdAt))

  // --- กรณีแชร์เป็นโฟลเดอร์ ---
  if (isFolder) {
    // 7. ดึงไฟล์ทั้งหมดใน fullPath
    const files = await FileModel.find({
      owner: ownerId,
      folderPath: { $regex: `^${fullPath}(/|$)` },
    })
      .sort({ folderPath: 1 })
      .lean<FileDoc[]>()
      .exec()

    // 8. ถ้า shareOption=department ดึงชื่อแผนก
    let sharedDepNames: string[] = []
    if (shareOption === 'department' && sharedWithDepartments.length > 0) {
      sharedDepNames = (
        await DepartmentModel.find(
          { _id: { $in: sharedWithDepartments } },
          'name'
        )
          .lean<{ name: string }[]>()
          .exec()
      ).map((d) => d.name)
    }

    return (
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">🌐 โฟลเดอร์ที่แชร์</h1>
        <div className="bg-white rounded-md shadow-md p-4">
          <p className="font-medium break-all mb-1">{folderPath}</p>
          <p className="text-sm text-gray-500">
            ประเภท:{' '}
            <span className="font-medium">{TYPE_LABELS.folder}</span>
          </p>
          <p className="text-sm text-gray-500">
            แชร์แบบ:{' '}
            <span className="font-medium">
              {SHARE_OPTION_LABELS[shareOption]}
            </span>
          </p>
          {sharedDepNames.length > 0 && (
            <p className="text-sm text-gray-500">
              แผนก/กอง:{' '}
              <span className="font-medium">{sharedDepNames.join(', ')}</span>
            </p>
          )}
          <p className="text-sm text-gray-500">
            วันที่แชร์:{' '}
            <span className="font-medium">{formattedDate}</span>
          </p>
          <div className="flex justify-center mt-3">
            <a
              href={`/api/files/download-folder/${id}`}
              className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md shadow-md"
            >
              <CloudDownload className="w-5 h-5" />
              ดาวน์โหลดโฟลเดอร์ (ZIP)
            </a>
          </div>
          <ul className="mt-4 list-disc list-inside">
            {files.map((f) => (
              <li key={String(f._id)} className="text-gray-800">
                {f.fileType === 'folder' ? '📁' : '📄'} {f.fileName}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  // --- กรณีแชร์เป็นไฟล์เดี่ยว ---
  // 9. โหลดข้อมูลไฟล์เดี่ยว
  const fileData = await FileModel.findById(fileId).lean<IFile>().exec()
  if (!fileData) return notFound()

  // 10. ถ้า shareOption=department ดึงชื่อแผนก
  const sharedDepNamesFile =
    shareOption === 'department' && sharedWithDepartments.length > 0
      ? (
          await DepartmentModel.find(
            { _id: { $in: sharedWithDepartments } },
            'name'
          )
            .lean<{ name: string }[]>()
            .exec()
        ).map((d) => d.name)
      : []

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">🌐 ไฟล์ที่แชร์</h1>
      <div className="bg-white rounded-md shadow-md p-4">
        <p className="font-medium break-all mb-1">{fileData.fileName}</p>
        <p className="text-sm text-gray-500">
          ประเภท:{' '}
          <span className="font-medium">
            {labelFromMime(fileData.fileType)}
          </span>
        </p>
        <p className="text-sm text-gray-500">
          แชร์แบบ:{' '}
          <span className="font-medium">
            {SHARE_OPTION_LABELS[shareOption]}
          </span>
        </p>
        {sharedDepNamesFile.length > 0 && (
          <p className="text-sm text-gray-500">
            แชร์ให้:{' '}
            <span className="font-medium">
              {sharedDepNamesFile.join(', ')}
            </span>
          </p>
        )}
        <p className="text-sm text-gray-500">
          วันที่แชร์:{' '}
          <span className="font-medium">{formattedDate}</span>
        </p>
        <SharedFileContent
          fileName={fileData.fileName}
          fileType={fileData.fileType}
          filePath={fileData.filePath}
          isSecret={Boolean(fileData.isSecret)}
        />
        <div className="flex justify-center mt-4">
          <DownloadButton
            filePath={fileData.filePath}
            isSecret={Boolean(fileData.isSecret)}
          />
        </div>
      </div>
    </div>
  )
}
