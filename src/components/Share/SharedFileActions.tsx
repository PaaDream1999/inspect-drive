// inspect-drive/src/components/Share/SharedFileActions.tsx

"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr"; // import SWR mutate
import DropdownMenu from "./DropdownMenu";
import ShareSettings from "./ShareSettings";
import mongoose from "mongoose";

type FileData = {
  _id: string | mongoose.Types.ObjectId;
  fileName?: string;
  fileType?: string;
};

type Props = {
  sharedId: string;
  file?: FileData | null;
  folder?: string;
  isPinned?: boolean;
};

const SharedFileActions = memo(({ sharedId, file, folder, isPinned = false }: Props) => {
  const [showOptions, setShowOptions] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const toggleOptions = useCallback(() => {
    setShowOptions((prev) => !prev);
  }, []);

  const handleView = useCallback(() => {
    router.push(`/share/${sharedId}`);
    setShowOptions(false);
  }, [router, sharedId]);

  const handlePinToggle = useCallback(async () => {
    try {
      const res = await fetch(`/api/files/share/pin/${sharedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !isPinned }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`เกิดข้อผิดพลาด: ${data.error || "ไม่ทราบสาเหตุ"}`);
      } else {
        alert("ปรับสถานะปักหมุดเรียบร้อยแล้ว");
        // สามารถใช้ mutate ได้เช่นกัน ถ้าต้องการรีเฟรช list โดยไม่ refresh หน้า modal
        mutate("/api/files/share");
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error toggling pin:", error);
        alert(`เกิดข้อผิดพลาดในการปรับสถานะปักหมุด: ${error.message || "ไม่ทราบสาเหตุ"}`);
      } else {
        console.error("Error toggling pin:", error);
        alert("เกิดข้อผิดพลาดในการปรับสถานะปักหมุด: ไม่ทราบสาเหตุ");
      }
    }
    setShowOptions(false);
  }, [sharedId, isPinned]);

  const handleDelete = useCallback(async () => {
    const isFolder = folder && folder.trim() !== "";
    const confirmMsg = isFolder
      ? "คุณแน่ใจหรือไม่ที่จะลบลิงก์แชร์โฟลเดอร์นี้ ?"
      : "คุณแน่ใจหรือไม่ที่จะลบลิงก์แชร์นี้ ?";
    if (confirm(confirmMsg)) {
      try {
        const res = await fetch(`/api/files/share/${sharedId}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json();
          alert(`เกิดข้อผิดพลาดในการลบลิงก์: ${data.error || "ไม่ทราบสาเหตุ"}`);
        } else {
          alert("ลบลิงก์สำเร็จ");
          // เรียก SWR mutate เพื่อ revalidate shared files list หลังลบ
          mutate("/api/files/share");
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error("Error deleting shared file/folder:", error);
          alert(`เกิดข้อผิดพลาดในการลบลิงก์: ${error.message || "ไม่ทราบสาเหตุ"}`);
        } else {
          console.error("Error deleting shared file/folder:", error);
          alert("เกิดข้อผิดพลาดในการลบลิงก์: ไม่ทราบสาเหตุ");
        }
      }
      setShowOptions(false);
    }
  }, [sharedId, folder]);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setShowOptions(false);
    }
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setShowOptions(false);
    }
  }, []);

  useEffect(() => {
    if (showOptions) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showOptions, handleClickOutside, handleKeyDown]);

  const shouldShowSettings = (file !== undefined && file !== null) || (folder && folder.trim() !== "");

  return (
    <>
      <div className="relative ml-4" ref={menuRef}>
        <button
          type="button"
          onClick={toggleOptions}
          className="bg-blue-500 hover:bg-blue-600 text-white px-2.5 py-1 rounded-md"
        >
          ☰
        </button>

        {showOptions && (
          <DropdownMenu>
            <button
              type="button"
              onClick={handleView}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              เปิดลิงก์
            </button>
            <button
              type="button"
              onClick={handlePinToggle}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              {isPinned ? "ยกเลิกปักหมุด" : "ปักหมุด"}
            </button>
            {shouldShowSettings && (
              <button
                type="button"
                onClick={() => {
                  setOpenSettings(true);
                  setShowOptions(false);
                }}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                ตั้งค่าลิงค์
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
            >
              ลบลิงก์
            </button>
          </DropdownMenu>
        )}
      </div>

      {openSettings && shouldShowSettings && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="relative w-full max-w-[90vw] sm:max-w-[500px]">
            <button
              type="button"
              onClick={() => setOpenSettings(false)}
              className="absolute right-1 text-gray-600 z-10"
            >
              ✖︎
            </button>
            <ShareSettings file={file} folder={folder} />
          </div>
        </div>
      )}
    </>
  );
});

SharedFileActions.displayName = "SharedFileActions";

export default SharedFileActions;
