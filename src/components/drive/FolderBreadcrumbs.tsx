// inspect-drive/src/components/Drive/FolderBreadcrumbs.tsx

"use client";

import React, { useState, useCallback } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";

interface CustomRouter {
  replace(url: string): void;
}

export interface FolderBreadcrumbsProps {
  folderPath: string;
  searchParams: ReadonlyURLSearchParams;
  router: CustomRouter;
  refreshFiles?: () => void;
}

interface DragDataItem {
  sourceId: string;
  currentFolderPath?: string;
}

export default function FolderBreadcrumbs({
  folderPath,
  searchParams,
  router,
  refreshFiles,
}: FolderBreadcrumbsProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // สร้าง breadcrumbs จาก folderPath โดยเริ่มจาก Root
  const folders = folderPath ? folderPath.split("/") : [];
  const breadcrumbs = [
    { name: "Root", path: "" },
    ...folders.map((folder, i) => ({
      name: folder,
      path: folders.slice(0, i + 1).join("/"),
    })),
  ];

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLLIElement>, index: number) => {
      e.preventDefault();
      setDragOverIndex(index);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLLIElement>, crumbPath: string) => {
      e.preventDefault();
      setDragOverIndex(null);

      const destinationPath = crumbPath || "";

      const rawData = e.dataTransfer.getData("application/json");
      if (!rawData) {
        console.warn("No drag data found");
        return;
      }
      let dragData: DragDataItem | DragDataItem[];
      try {
        dragData = JSON.parse(rawData);
      } catch (error) {
        console.error("Error parsing drag data:", error);
        return;
      }

      async function moveItem(
        sourceId: string,
        currentFolderPath: string,
        destinationPath: string
      ) {
        console.log("Moving item:", { sourceId, currentFolderPath, destinationPath });
        const res = await fetch("/api/files/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId,
            currentFolderPath: currentFolderPath || "",
            destinationPath: destinationPath || "",
          }),
        });
        if (!res.ok) {
          const result = await res.json();
          alert(`Error moving item: ${result.error || "Unknown error"}`);
        }
      }

      if (Array.isArray(dragData)) {
        // ย้ายรายการทั้งหมดพร้อมกัน
        await Promise.all(
          dragData.map(async (item) => {
            if (!item.sourceId) {
              console.error("Missing sourceId in dragData item:", item);
              alert("Error moving item: Missing required field (sourceId)");
              return;
            }
            await moveItem(item.sourceId, item.currentFolderPath || "", destinationPath);
          })
        );
      } else {
        if (!dragData.sourceId) {
          console.error("Missing sourceId in dragData:", dragData);
          alert("Error moving item: Missing required field (sourceId)");
          return;
        }
        await moveItem(dragData.sourceId, dragData.currentFolderPath || "", destinationPath);
      }

      if (refreshFiles) refreshFiles();
    },
    [refreshFiles]
  );

  const handleClickBreadcrumb = useCallback(
    (crumbPath: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (crumbPath) {
        params.set("folder", crumbPath);
      } else {
        params.delete("folder");
      }
      params.delete("page");
      router.replace(`/drive?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <nav className="inline-block px-1 py-1 bg-white rounded-md shadow-md">
      <ul className="flex items-center space-x-1 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <li
            key={`${crumb.path}-${index}`}
            className={`flex items-center cursor-pointer transition-colors text-gray-600 rounded-md px-1 ${
              dragOverIndex === index ? "bg-gray-200" : "hover:bg-gray-100"
            }`}
            onClick={() => handleClickBreadcrumb(crumb.path)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, crumb.path)}
          >
            {crumb.name}
            {index < breadcrumbs.length - 1 && <span className="mx-1 text-gray-400">/</span>}
          </li>
        ))}
      </ul>
    </nav>
  );
}
