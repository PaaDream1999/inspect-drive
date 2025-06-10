// inspect-drive/src/components/Share/SharedList.tsx

'use client';

import React, { FC, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useSearchParams, usePathname } from 'next/navigation';
import SharedFileActions from './SharedFileActions';
import Pagination from '../Pagination';
import { getFileIcon } from '@/utils/getFileIcon';
import { TYPE_LABELS, labelFromMime } from '@/utils/fileLabels';

const PAGE_SIZE = 10;

const SHARE_OPTION_LABELS = {
  public: 'สาธารณะ',
  private: 'ส่วนตัว',
  department: 'แผนก/กอง',
  secret: 'ลับ',
} as const;

type ShareOption = keyof typeof SHARE_OPTION_LABELS;

interface FileData {
  _id: string;
  fileName: string;
  fileType: string;
  filePath?: string;
}

interface SharedFile {
  _id: string;
  isFolder: boolean;
  folderPath?: string;
  file?: FileData | null;
  isPinned?: boolean;
  pinnedAt?: string;
  shareOption: ShareOption;
  sharedWithDepartments?: string[];
  createdAt: string;
}

interface Department {
  _id: string;
  name: string;
}

interface SharedFilesResponse {
  sharedFiles: SharedFile[];
}

interface DepartmentsResponse {
  departments: Department[];
}

class FetchError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 401) {
    throw new FetchError(401, 'Unauthorized');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new FetchError(res.status, text);
  }
  return res.json();
}

const SharedList: FC = () => {
  const searchParamsRaw = useSearchParams();
  const pathname = usePathname();

  const currentPage = useMemo(() => {
    const p = searchParamsRaw.get('page');
    const num = p ? parseInt(p, 10) : 1;
    return Number.isNaN(num) || num < 1 ? 1 : num;
  }, [searchParamsRaw]);

  const params = useMemo(
    () => new URLSearchParams(searchParamsRaw.toString()),
    [searchParamsRaw]
  );

  const { data: sfData, error: sfErr } = useSWR<SharedFilesResponse, FetchError>(
    '/api/files/share',
    fetcher
  );
  const { data: deptData, error: deptErr } = useSWR<DepartmentsResponse, FetchError>(
    '/api/departments',
    fetcher
  );

  useEffect(() => {
    if (sfErr?.status === 401 || deptErr?.status === 401) {
      void signIn();
    }
  }, [sfErr, deptErr]);

  const sharedFiles = useMemo(() => sfData?.sharedFiles ?? [], [sfData]);
  const departments = useMemo(() => deptData?.departments ?? [], [deptData]);
  const deptMap = useMemo(
    () => new Map(departments.map((d) => [d._id, d.name])),
    [departments]
  );

  const sortedFiles = useMemo(() => {
    return [...sharedFiles].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const ta = Date.parse(a.pinnedAt ?? a.createdAt);
      const tb = Date.parse(b.pinnedAt ?? b.createdAt);
      return tb - ta;
    });
  }, [sharedFiles]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedFiles.length / PAGE_SIZE)),
    [sortedFiles]
  );

  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedFiles.slice(start, start + PAGE_SIZE);
  }, [sortedFiles, currentPage]);

  if (sfErr && sfErr.status !== 401) {
    return <p className="text-center text-red-600">เกิดข้อผิดพลาด: {sfErr.message}</p>;
  }

  if (!sfData || !deptData) {
    return <p className="text-center text-gray-500">กำลังโหลดข้อมูล…</p>;
  }

  if (sortedFiles.length === 0) {
    return <p className="text-center text-gray-500">ยังไม่มีไฟล์หรือโฟลเดอร์ที่แชร์</p>;
  }

  return (
    <>
      <ul className="mb-4 p-2 bg-white rounded-md shadow-md">
        {paginatedFiles.map((sf) => {
          const mime = sf.file?.fileType ?? '';
          const sharedWith = sf.sharedWithDepartments ?? [];
          const icon = !sf.isFolder && getFileIcon(mime, sf.shareOption === 'secret' && mime.startsWith('image/'));

          const thumb = sf.isFolder ? (
            <Image
              src="/icons/folder-icon.png"
              width={40}
              height={40}
              alt="Folder"
              className="rounded-md"
              unoptimized
            />
          ) : icon ? (
            <Image
              src={icon}
              width={40}
              height={40}
              alt={sf.file?.fileName ?? ''}
              className="rounded-md"
              unoptimized
            />
          ) : sf.file?.filePath ? (
            <Image
              src={sf.file.filePath}
              width={40}
              height={40}
              alt={sf.file?.fileName ?? ''}
              className="rounded-md"
              unoptimized
            />
          ) : (
            <div className="w-10 h-10 flex items-center justify-center bg-gray-200 rounded-md">
              <span className="text-xs text-gray-600">No Icon</span>
            </div>
          );

          const linkHref = `/share/${encodeURIComponent(sf._id)}`;

          return (
            <li key={sf._id} className="border-b p-2 last:border-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <Link
                    href={linkHref}
                    className="flex-shrink-0"
                    aria-label={sf.isFolder ? 'เปิดโฟลเดอร์' : 'เปิดไฟล์'}
                    title={sf.isFolder ? 'เปิดโฟลเดอร์' : sf.file?.fileName ?? ''}
                  >
                    {thumb}
                  </Link>

                  <Link
                    href={linkHref}
                    className="font-medium truncate hover:text-blue-600"
                    aria-label={sf.isFolder ? 'เปิดโฟลเดอร์' : 'เปิดไฟล์'}
                    title={sf.isFolder ? 'เปิดโฟลเดอร์' : sf.file?.fileName ?? ''}
                  >
                    {sf.isPinned && <span className="text-yellow-500" title="ปักหมุด">★ </span>}
                    {sf.isFolder ? sf.folderPath?.split('/').pop() : sf.file?.fileName}
                  </Link>
                </div>

                <SharedFileActions
                  sharedId={sf._id}
                  file={!sf.isFolder ? sf.file : undefined}
                  folder={sf.isFolder ? sf.folderPath : undefined}
                  isPinned={sf.isPinned}
                />
              </div>

              <div className="mt-1 space-y-0.5 text-gray-500 text-sm">
                <p>ประเภท: {sf.isFolder ? TYPE_LABELS.folder : labelFromMime(mime)}</p>
                <p>แชร์แบบ: {SHARE_OPTION_LABELS[sf.shareOption]}</p>
                {sf.shareOption === 'department' && sharedWith.length > 0 && (
                  <p>แชร์ให้: {sharedWith.map((id) => deptMap.get(id) ?? id).join(', ')}</p>
                )}
                <p>
                  แชร์เมื่อ:{' '}
                  {new Intl.DateTimeFormat('th-TH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(sf.createdAt))}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        searchParams={params}
        pathname={pathname}
      />
    </>
  );
};

export default SharedList;
