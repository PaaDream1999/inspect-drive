// inspect-drive\src\app\drive\page.tsx

"use client";

import React, { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import DriveFileListMultiSelect from "@/components/drive/DriveFileListMultiSelect";
import Pagination from "@/components/Pagination";
import MediaPreviewModal from "@/components/drive/MediaPreviewModal";
import ShareFileModal from "@/components/drive/ShareFileModal";
import ShareFolderModal from "@/components/drive/ShareFolderModal";
import FolderBreadcrumbs from "@/components/drive/FolderBreadcrumbs";
import FilterButtons from "@/components/drive/FilterButtons";
import SortButtons from "@/components/drive/SortButtons";

export interface FileData {
  _id: string;
  owner?: string;
  folderPath?: string;
  fileName: string;
  fileType: string;
  filePath: string | null;
  createdAt: string;
  updatedAt?: string;
  fileSize?: number;
  isSecret?: boolean;
}

export default function MyDrive() {
  return (
    <Suspense fallback={<p className="text-center text-gray-500 mt-4">กำลังโหลดข้อมูล...</p>}>
      <DrivePage />
    </Suspense>
  );
}

function DrivePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const folderPath = searchParams.get("folder") || "";
  const currentPage = Number(searchParams.get("page")) || 1;
  const itemsPerPage = 20;

  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [shareFile, setShareFile] = useState<FileData | null>(null);
  const [shareFolder, setShareFolder] = useState<string | null>(null);
  const [mediaMode, setMediaMode] = useState<"image" | "video" | null>(null);

  // สำหรับเลื่อนรูป/วิดีโอใน modal
  const [mediaIndex, setMediaIndex] = useState(0);
  const [folderImages, setFolderImages] = useState<FileData[]>([]);
  const [folderVideos, setFolderVideos] = useState<FileData[]>([]);

  // Filter, Sort
  const [filter, setFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newToOld");

  // ข้อมูลพื้นที่เก็บไฟล์
  const [storageInfo, setStorageInfo] = useState<{ used: number; quota: number } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // ฟังก์ชันดึงรายการไฟล์จาก API
  const refreshFiles = useCallback(async () => {
    try {
      setLoading(true);
      const query = folderPath ? `?folder=${encodeURIComponent(folderPath)}` : "";
      const res = await fetch(`/api/files/list${query}`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  }, [folderPath]);

  // โหลดไฟล์เมื่อ user login แล้ว
  useEffect(() => {
    if (status !== "authenticated") return;
    refreshFiles();

    const username = session?.user?.name || "";
    if (username) {
      fetch(`/api/files/storage?username=${username}`)
        .then((res) => res.json())
        .then((data) => {
          setStorageInfo({ used: data.used, quota: data.storageQuota });
        })
        .catch((error) => console.error("Error fetching storage info:", error));
    }
  }, [session, status, refreshFiles]);

  // จัดการ Filter + Sort
  const displayedItems = useMemo(() => {
    const filtered = files.filter((item) => {
      if (filter === "all") return true;
      if (filter === "folder") return item.fileType === "folder";
      if (filter === "images") return item.fileType.startsWith("image/");
      if (filter === "videos") return item.fileType.startsWith("video/");
      if (filter === "pdf") return item.fileType.includes("pdf");
      if (filter === "text") return item.fileType.startsWith("text/");
      if (filter === "word") return item.fileType.includes("word");
      if (filter === "excel") {
        return (
          item.fileType.includes("excel") ||
          item.fileType.includes("officedocument.spreadsheetml")
        );
      }
      if (filter === "powerpoint") {
        return (
          item.fileType.includes("powerpoint") ||
          item.fileType.includes("officedocument.presentationml")
        );
      }
      if (filter === "audio") return item.fileType.startsWith("audio/");
      if (filter === "zip") {
        return item.fileType.includes("zip") || item.fileType.includes("compressed");
      }
      return true;
    });

    // ใช้ updatedAt สำหรับการ sort แทน createdAt
    filtered.sort((a, b) => {
      const dateA = new Date(a.updatedAt || "").getTime();
      const dateB = new Date(b.updatedAt || "").getTime();
      return sortOrder === "newToOld" ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [files, filter, sortOrder]);

  // Pagination
  const totalPages = useMemo(
    () => Math.ceil(displayedItems.length / itemsPerPage),
    [displayedItems]
  );
  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return displayedItems.slice(startIndex, startIndex + itemsPerPage);
  }, [displayedItems, currentPage]);

  // ฟังก์ชันเปิดไฟล์ (ภาพ/วิดีโอ/อื่น ๆ)
  const openMediaFile = useCallback(
    (file: FileData) => {
      setSelectedFile(file);
      if (file.fileType.startsWith("image/")) {
        setMediaMode("image");
        const images = displayedItems.filter((f) => f.fileType.startsWith("image/"));
        setFolderImages(images);
        const idx = images.findIndex((img) => img._id === file._id);
        setMediaIndex(idx !== -1 ? idx : 0);
      } else if (file.fileType.startsWith("video/")) {
        setMediaMode("video");
        const videos = displayedItems.filter((f) => f.fileType.startsWith("video/"));
        setFolderVideos(videos);
        const idx = videos.findIndex((vid) => vid._id === file._id);
        setMediaIndex(idx !== -1 ? idx : 0);
      } else {
        setMediaMode(null);
      }
    },
    [displayedItems]
  );

  // ปุ่มเลื่อน media
  const handlePrev = useCallback(() => {
    if (mediaMode === "image" && folderImages.length) {
      const newIndex = (mediaIndex - 1 + folderImages.length) % folderImages.length;
      setMediaIndex(newIndex);
      setSelectedFile(folderImages[newIndex]);
    } else if (mediaMode === "video" && folderVideos.length) {
      const newIndex = (mediaIndex - 1 + folderVideos.length) % folderVideos.length;
      setMediaIndex(newIndex);
      setSelectedFile(folderVideos[newIndex]);
    }
  }, [mediaMode, mediaIndex, folderImages, folderVideos]);

  const handleNext = useCallback(() => {
    if (mediaMode === "image" && folderImages.length) {
      const newIndex = (mediaIndex + 1) % folderImages.length;
      setMediaIndex(newIndex);
      setSelectedFile(folderImages[newIndex]);
    } else if (mediaMode === "video" && folderVideos.length) {
      const newIndex = (mediaIndex + 1) % folderVideos.length;
      setMediaIndex(newIndex);
      setSelectedFile(folderVideos[newIndex]);
    }
  }, [mediaMode, mediaIndex, folderImages, folderVideos]);

  // ลบไฟล์เดี่ยว
  const handleDeleteFile = useCallback(async (fileId: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบไฟล์นี้ ?")) return;
    try {
      const res = await fetch(`/api/files/delete/${fileId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(`เกิดข้อผิดพลาดในการลบไฟล์: ${data.error}`);
      } else {
        setFiles((prev) => prev.filter((f) => f._id !== fileId));
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("เกิดข้อผิดพลาดในการลบไฟล์");
    }
  }, []);

  // ลบโฟลเดอร์เดี่ยว
  const handleDeleteFolder = useCallback(async (folderName: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ที่จะลบโฟลเดอร์ "${folderName}" ทั้งหมด ?`)) return;
    try {
      const fullPath = folderPath ? `${folderPath}/${folderName}` : folderName;
      const res = await fetch(
        `/api/files/delete-folder?folderName=${encodeURIComponent(fullPath)}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const data = await res.json();
        alert(`เกิดข้อผิดพลาดในการลบโฟลเดอร์: ${data.error}`);
      } else {
        setFiles((prev) =>
          prev.filter((f) => {
            const fFullPath = f.folderPath ? `${f.folderPath}/${f.fileName}` : f.fileName;
            return !fFullPath.startsWith(fullPath + "/") && fFullPath !== fullPath;
          })
        );
        if (folderPath === folderName) {
          router.replace("/drive");
        }
      }
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("เกิดข้อผิดพลาดในการลบโฟลเดอร์");
    }
  }, [folderPath, router]);

  // Helper แปลง Byte -> GB
  const toGB = (bytes: number) => (bytes / 1024 ** 3).toFixed(2);

  if (status === "loading" || loading) {
    return <p className="text-center text-gray-500 mt-4">กำลังโหลดข้อมูล...</p>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">📁 ไดรฟ์ของฉัน</h1>

      {storageInfo && (
        <div className="mb-4 p-4 bg-white rounded-md shadow-md">
          <p>
            พื้นที่ใช้ไป {toGB(storageInfo.used)} GB จากทั้งหมด {toGB(storageInfo.quota)} GB
          </p>

          {/* ใช้ Tailwind progress bar */}
          <div className="w-full h-4 bg-gray-200 rounded overflow-hidden mt-2">
            <div
              className="h-full bg-green-400 transition-all duration-300"
              style={{
                width: `${(storageInfo.used / storageInfo.quota) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ปุ่ม Filter */}
      <FilterButtons filter={filter} setFilter={setFilter} />

      {/* ปุ่ม Sort */}
      <SortButtons sortOrder={sortOrder} setSortOrder={setSortOrder} />

      {/* Breadcrumbs และปุ่มกลับ (ถ้าอยู่ในโฟลเดอร์) */}
      {folderPath && (
        <div className="flex items-center justify-between mb-4">
          <FolderBreadcrumbs
            folderPath={folderPath}
            searchParams={searchParams}
            router={router}
            refreshFiles={refreshFiles}
          />
          <button
            onClick={() => {
              const segments = folderPath.split("/");
              segments.pop();
              const newPath = segments.join("/");
              const params = new URLSearchParams(searchParams.toString());
              if (newPath) params.set("folder", newPath);
              else params.delete("folder");
              params.delete("page");
              router.replace(`/drive?${params.toString()}`);
            }}
            className="inline-block px-2 py-1 bg-white text-sm rounded-md shadow-md hover:bg-gray-100"
          >
            ⬅️ กลับ
          </button>
        </div>
      )}

      {/* แสดงรายการไฟล์ */}
      {displayedItems.length === 0 ? (
        <p className="text-center text-gray-500">ไม่มีไฟล์หรือโฟลเดอร์ที่อัปโหลด</p>
      ) : (
        <>
          <DriveFileListMultiSelect
            items={currentItems}
            folderPath={folderPath}
            searchParams={searchParams}
            router={router}
            refreshFiles={refreshFiles}
            openMediaFile={openMediaFile}
            setShareFile={setShareFile}
            setSelectedFile={setSelectedFile}
            handleDeleteFile={handleDeleteFile}
            setShareFolder={setShareFolder}
            handleDeleteFolder={handleDeleteFolder}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            searchParams={searchParams}
            pathname="/drive"
          />
        </>
      )}

      {/* Modal แชร์ไฟล์ */}
      {shareFile && <ShareFileModal shareFile={shareFile} onClose={() => setShareFile(null)} />}

      {/* Modal แชร์โฟลเดอร์ */}
      {shareFolder && (
        <ShareFolderModal shareFolder={shareFolder} onClose={() => setShareFolder(null)} />
      )}

      {/* Modal Preview (image / video / text / pdf) */}
      {selectedFile && (
        <MediaPreviewModal
          selectedFile={selectedFile}
          mediaMode={mediaMode}
          handlePrev={handlePrev}
          handleNext={handleNext}
          onClose={() => {
            setSelectedFile(null);
            setMediaMode(null);
          }}
        />
      )}
    </div>
  );
}
