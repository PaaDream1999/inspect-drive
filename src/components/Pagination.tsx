// inspect-drive/src/components/Pagination.tsx

import React from "react";
import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  searchParams: URLSearchParams;
  pathname: string; // prop สำหรับระบุ pathname (เช่น "/drive" หรือ "/share")
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, searchParams, pathname }) => {
  return (
    <div className="mt-4 flex items-center justify-center space-x-4">
      {currentPage > 1 && (
        <Link
          href={{
            pathname,
            query: { ...Object.fromEntries(searchParams.entries()), page: currentPage - 1 },
          }}
          className="text-sm text-gray-500 px-1 bg-white rounded-md hover:bg-gray-100 shadow-md"
        >
          ◀
        </Link>
      )}
      <span className="text-xs text-gray-500 font-semibold">
        หน้าที่ {currentPage} จาก {totalPages}
      </span>
      {currentPage < totalPages && (
        <Link
          href={{
            pathname,
            query: { ...Object.fromEntries(searchParams.entries()), page: currentPage + 1 },
          }}
          className="text-sm text-gray-500 px-1 bg-white rounded-md hover:bg-gray-100 shadow-md"
        >
          ▶
        </Link>
      )}
    </div>
  );
};

export default React.memo(Pagination);
