// inspect-drive\src\components\DepartmentColumn.tsx

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { getFileIcon } from "@/utils/getFileIcon";
import type { ValidSharedFile } from "@/app/deptshare/page";

interface DepartmentColumnProps {
  department: string;
  items: ValidSharedFile[];
  singleColumn?: boolean;
}

const ITEMS_PER_PAGE = 5;

export default function DepartmentColumn({ department, items, singleColumn = false }: DepartmentColumnProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const paginatedItems = items.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    console.log("DEBUG: DepartmentColumn for:", department);
    console.log("DEBUG: Items received:", items);
  }, [department, items]);

  const handlePrev = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNext = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  const deptName = String(department).trim();

  const containerClasses = `break-inside-avoid bg-white p-2 rounded-md shadow ${
    singleColumn ? "w-full" : ""
  }`;

  return (
    <div className={containerClasses}>
      <h2 className="text-xl font-semibold mb-2 text-center">{deptName}</h2>
      <ul className="space-y-2">
        {paginatedItems.length === 0 ? (
          <li className="text-gray-500 text-sm text-center">ไม่มีสิ่งที่แชร์</li>
        ) : (
          paginatedItems.map((sf) => {
            console.log("DEBUG: Rendering item with _id:", sf._id);
            const displayName = sf.isFolder
              ? sf.folderPath?.split("/").pop() || "Unnamed Folder"
              : sf.file?.fileName || "Unnamed File";

            let iconElement = null;
            if (sf.isFolder) {
              iconElement = (
                <Image
                  src="/icons/folder-icon.png"
                  alt="Folder Icon"
                  width={40}
                  height={40}
                  className="object-cover rounded-md inline-block mr-2"
                />
              );
            } else if (sf.file) {
              const icon = getFileIcon(sf.file.fileType || "");
              iconElement = icon ? (
                <Image
                  src={icon}
                  alt={sf.file.fileName || "File Icon"}
                  width={40}
                  height={40}
                  className="rounded-md inline-block mr-2"
                />
              ) : (
                <Image
                  src={sf.file.filePath || "/icons/file-icon.png"}
                  alt={sf.file.fileName || "File"}
                  width={40}
                  height={40}
                  className="object-cover rounded-md inline-block mr-2"
                />
              );
            }

            let sharedBy = "";
            if (sf.isFolder && sf.owner && typeof sf.owner !== "string") {
              sharedBy = sf.owner.username || "";
            } else if (!sf.isFolder && sf.file && typeof sf.file !== "string") {
              sharedBy = sf.file.owner?.username || "";
            }

            return (
              <li key={String(sf._id)} className="border p-2 rounded hover:bg-gray-50">
                <Link href={`/share/${sf._id}`} className="block w-full" title={displayName}>
                  <div className="flex items-center min-w-0">
                    {iconElement}
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">
                        {sf.isPinned && (
                          <span className="text-yellow-500" title="ปักหมุด">
                            ★{" "}
                          </span>
                        )}
                        {displayName}
                      </span>
                      <p className="text-xs text-gray-500">
                        {(() => {
                        const d = new Date(sf.createdAt);
                        return isNaN(d.getTime())
                          ? "N/A"
                          : new Intl.DateTimeFormat("th-TH", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Asia/Bangkok",
                          }).format(d);
                        })()}
                        {sharedBy ? ` | โดย: ${sharedBy}` : ""}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })
        )}
      </ul>
      {totalPages > 1 && (
        <div className="flex items-center justify-center mt-2 gap-2">
          <button
            onClick={handlePrev}
            disabled={currentPage === 1}
            className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300"
          >
            ◀
          </button>
          <span className="text-xs text-gray-600">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={handleNext}
            disabled={currentPage === totalPages}
            className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300"
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}