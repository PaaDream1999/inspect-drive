// inspect-drive/src/components/Drive/DriveFileListMultiSelect.tsx

"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  MouseEvent,
  TouchEvent,
  DragEvent,
} from "react";
import { FileData } from "@/app/drive/page";
import { getFileIcon } from "@/utils/getFileIcon";
import type { ReadonlyURLSearchParams } from "next/navigation";
import Image from "next/image";

/**
 * Interface สำหรับ router แบบ custom
 */
interface CustomRouter {
  replace: (url: string) => void;
}

/**
 * Interface สำหรับข้อมูลของไฟล์ที่ถูกลาก
 */
interface DragItem {
  sourceId: string;
  fileType: string;
  fileName: string;
  currentFolderPath: string;
}

/**
 * Props สำหรับ component นี้
 */
export interface DriveFileListMultiSelectProps {
  items: FileData[];
  folderPath: string;
  searchParams: ReadonlyURLSearchParams;
  router: CustomRouter;
  refreshFiles?: () => void;
  // ฟังก์ชันสำหรับ dropdown actions (เฉพาะใน non-selection mode)
  openMediaFile: (file: FileData) => void;
  setShareFile: (file: FileData) => void;
  setSelectedFile: (file: FileData) => void;
  handleDeleteFile: (id: string) => void;
  setShareFolder: (folder: string) => void;
  handleDeleteFolder: (folder: string) => void;
}

// กำหนดระยะเวลา long press (หน่วยเป็น ms)
const LONG_PRESS_DURATION = 800;
// กำหนด threshold การเคลื่อนที่ (หน่วยเป็นพิกเซล) เพื่อแยกการลากกับการแตะธรรมดา
const DRAG_THRESHOLD = 10;

const DriveFileListMultiSelect: React.FC<DriveFileListMultiSelectProps> = ({
  items,
  folderPath,
  searchParams,
  router,
  refreshFiles,
  openMediaFile,
  setShareFile,
  setSelectedFile,
  handleDeleteFile,
  setShareFolder,
  handleDeleteFolder,
}: DriveFileListMultiSelectProps) => {
  // State สำหรับควบคุมโหมดเลือกหลายรายการ
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  // ใช้ Set เพื่อเก็บ id ของรายการที่ถูกเลือก
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  // State สำหรับเก็บ timer ของ long press
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
  // State สำหรับควบคุม dropdown ที่เปิดอยู่
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  // State สำหรับเก็บ id ของโฟลเดอร์ที่อยู่ในสถานะ drag over
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  // Ref สำหรับเก็บ DOM node ของ container แต่ละ dropdown key เป็น id ของไฟล์
  const dropdownContainerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // สำหรับรองรับ touch drag
  const [touchDragData, setTouchDragData] = useState<DragItem | DragItem[] | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  // เก็บ item ที่ถูก touch เพื่อใช้ในการลาก
  const touchItemRef = useRef<FileData | null>(null);

  /**
   * ฟังก์ชันสำหรับย้ายไฟล์/โฟลเดอร์ (ใช้ร่วมกันระหว่าง drag & touch drop)
   */
  const moveItems = useCallback(
    async (dragData: DragItem | DragItem[], destination: string): Promise<void> => {
      const moveItem = async (
        sourceId: string,
        currentFolderPath: string,
        destinationPath: string
      ): Promise<void> => {
        await fetch("/api/files/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId,
            currentFolderPath,
            destinationPath,
          }),
        });
      };

      if (Array.isArray(dragData)) {
        await Promise.all(
          dragData.map(async (d: DragItem) => {
            if (d.fileType === "folder") {
              const oldFullPath = d.currentFolderPath
                ? `${d.currentFolderPath}/${d.fileName}`
                : d.fileName;
              const newFullPath = destination
                ? `${destination}/${d.fileName}`
                : d.fileName;
              if (
                oldFullPath === newFullPath ||
                newFullPath.startsWith(oldFullPath + "/")
              ) {
                console.warn("Cannot drop folder into itself or its subfolder");
                return;
              }
            }
            await moveItem(d.sourceId, d.currentFolderPath, destination);
          })
        );
      } else {
        if (dragData.fileType === "folder") {
          const oldFullPath = dragData.currentFolderPath
            ? `${dragData.currentFolderPath}/${dragData.fileName}`
            : dragData.fileName;
          const newFullPath = destination
            ? `${destination}/${dragData.fileName}`
            : dragData.fileName;
          if (
            oldFullPath === newFullPath ||
            newFullPath.startsWith(oldFullPath + "/")
          ) {
            console.warn("Cannot drop folder into itself or its subfolder");
            return;
          }
        }
        await moveItem(dragData.sourceId, dragData.currentFolderPath, destination);
      }
    },
    []
  );

  /**
   * ฟังก์ชันสำหรับนำทางไปยังโฟลเดอร์ที่เลือก
   * เมื่อไม่ได้อยู่ในโหมดเลือกหลายรายการ
   */
  const handleNavigateFolder = useCallback(
    (item: FileData): void => {
      if (selectionMode) return;
      if (item.fileType === "folder") {
        const newFolderPath = folderPath
          ? `${folderPath}/${item.fileName}`
          : item.fileName;
        const params = new URLSearchParams(searchParams.toString());
        params.set("folder", newFolderPath);
        params.delete("page");
        router.replace(`/drive?${params.toString()}`);
      }
    },
    [selectionMode, folderPath, router, searchParams]
  );

  /**
   * ฟังก์ชันสำหรับ toggle การเลือก item
   */
  const handleToggleSelect = useCallback((itemId: string): void => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  /**
   * ฟังก์ชันสำหรับยกเลิกโหมดเลือกหลายรายการ
   */
  const cancelSelection = useCallback((): void => {
    setSelectionMode(false);
    setSelectedItems(new Set());
  }, []);

  /**
   * ฟังก์ชันสำหรับลบรายการที่ถูกเลือกทั้งหมด
   */
  const handleDeleteSelected = useCallback(async (): Promise<void> => {
    if (selectedItems.size === 0) {
      alert("ยังไม่ได้เลือกรายการ");
      return;
    }
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบรายการที่เลือก?")) return;

    const selectedArray = Array.from(selectedItems);
    // แยกโฟลเดอร์และไฟล์ออกจากกัน
    const folderItems = selectedArray
      .map((id) => items.find((item) => item._id === id))
      .filter((item): item is FileData => !!item && item.fileType === "folder");
    const fileItems = selectedArray
      .map((id) => items.find((item) => item._id === id))
      .filter((item): item is FileData => !!item && item.fileType !== "folder");

    // ลบไฟล์ทั้งหมดพร้อมกัน
    await Promise.all(
      fileItems.map(async (file) => {
        try {
          const res = await fetch(`/api/files/delete/${file._id}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const data = await res.json();
            alert(`เกิดข้อผิดพลาดในการลบไฟล์ ${file.fileName}: ${data.error}`);
          }
        } catch (error) {
          console.error("Error deleting file:", error);
          alert("เกิดข้อผิดพลาดในการลบไฟล์");
        }
      })
    );

    // ลบโฟลเดอร์ทั้งหมดพร้อมกัน
    await Promise.all(
      folderItems.map(async (folder) => {
        const fullFolderPath = folderPath
          ? `${folderPath}/${folder.fileName}`
          : folder.fileName;
        try {
          const res = await fetch(
            `/api/files/delete-folder?folderName=${encodeURIComponent(fullFolderPath)}`,
            { method: "DELETE" }
          );
          if (!res.ok) {
            const data = await res.json();
            alert(`เกิดข้อผิดพลาดในการลบโฟลเดอร์ ${folder.fileName}: ${data.error}`);
          }
        } catch (error) {
          console.error("Error deleting folder:", error);
          alert("เกิดข้อผิดพลาดในการลบโฟลเดอร์");
        }
      })
    );

    cancelSelection();
    if (refreshFiles) refreshFiles();
  }, [selectedItems, items, folderPath, refreshFiles, cancelSelection]);

  /**
   * ฟังก์ชันสำหรับจัดการเริ่มต้นการลาก (drag) ไฟล์หรือโฟลเดอร์
   * ถ้าอยู่ในโหมดเลือกหลายรายการและ item นั้นถูกเลือกไว้ จะทำการลากทั้งหมด
   */
  const handleDragStart = useCallback(
    (e: DragEvent, item: FileData): void => {
      let dragData: DragItem | DragItem[];
      if (selectionMode && selectedItems.has(item._id)) {
        dragData = Array.from(selectedItems)
          .map((id) => {
            const selectedItem = items.find((i) => i._id === id);
            return selectedItem
              ? {
                  sourceId: selectedItem._id,
                  fileType: selectedItem.fileType,
                  fileName: selectedItem.fileName,
                  currentFolderPath: selectedItem.folderPath || "",
                }
              : null;
          })
          .filter((item): item is DragItem => item !== null);
      } else {
        dragData = {
          sourceId: item._id,
          fileType: item.fileType,
          fileName: item.fileName,
          currentFolderPath: folderPath,
        };
      }
      e.dataTransfer.setData("application/json", JSON.stringify(dragData));
    },
    [selectionMode, selectedItems, items, folderPath]
  );

  /**
   * ฟังก์ชันสำหรับจัดการเมื่อปล่อย (drop) ไฟล์หรือโฟลเดอร์ลงบนโฟลเดอร์เป้าหมาย
   */
  const handleDropOnFolder = useCallback(
    (e: DragEvent, targetItem: FileData): void => {
      e.preventDefault();
      setDragOverFolderId(null);
      const targetFolderName = targetItem.fileName;
      const destination =
        folderPath && folderPath !== ""
          ? `${folderPath}/${targetFolderName}`
          : targetFolderName;
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;

      let dragData: DragItem | DragItem[];
      try {
        dragData = JSON.parse(data);
      } catch (err) {
        console.error("Error parsing drag data:", err);
        return;
      }
      moveItems(dragData, destination).then(() => {
        if (refreshFiles) refreshFiles();
      });
    },
    [folderPath, moveItems, refreshFiles]
  );

  /**
   * ฟังก์ชันสำหรับจัดการเมื่อลากเข้ามา (drag enter) บนโฟลเดอร์เป้าหมาย
   */
  const handleDragEnterFolder = useCallback(
    (e: DragEvent, folderId: string): void => {
      e.preventDefault();
      setDragOverFolderId(folderId);
    },
    []
  );

  /**
   * ฟังก์ชันสำหรับจัดการเมื่อออก (drag leave) จากโฟลเดอร์เป้าหมาย
   */
  const handleDragLeaveFolder = useCallback(
    (e: DragEvent, folderId: string): void => {
      if (dragOverFolderId === folderId) {
        setDragOverFolderId(null);
      }
    },
    [dragOverFolderId]
  );

  /**
   * ฟังก์ชันสำหรับจัดการคลิกที่ item
   * - ถ้าอยู่ในโหมดเลือกหลายรายการ: toggle การเลือก
   * - ถ้าไม่อยู่ในโหมดเลือก: เปิดไฟล์หรือโฟลเดอร์ตามประเภท
   */
  const handleItemClick = useCallback(
    (item: FileData) => {
      if (selectionMode) {
        // อยู่ในโหมดเลือก => แค่แตะก็ toggle ได้ทันที
        handleToggleSelect(item._id);
        return;
      }
      if (item.fileType === "folder") {
        handleNavigateFolder(item);
      } else if (
        item.fileType.startsWith("video/") ||
        item.fileType.startsWith("image/")
      ) {
        openMediaFile(item);
      } else {
        setSelectedFile(item);
      }
    },
    [selectionMode, handleToggleSelect, handleNavigateFolder, openMediaFile, setSelectedFile]
  );

  /**
   * ฟังก์ชันสำหรับเริ่มต้น long press เพื่อเข้าสู่โหมดเลือกหลายรายการ
   */
  const startLongPress = useCallback(
    (itemId: string): void => {
      const timer = window.setTimeout(() => {
        if (!selectionMode) {
          setSelectionMode(true);
          setSelectedItems(new Set([itemId]));
        }
      }, LONG_PRESS_DURATION);
      setLongPressTimer(timer);
    },
    [selectionMode]
  );

  /**
   * ฟังก์ชันสำหรับเคลียร์ long press timer เมื่อมีการเลิกกด
   */
  const clearLongPress = useCallback((): void => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  // ----- ส่วนสำหรับ touch events เพื่อรองรับ drag-drop บนมือถือ -----

  /**
   * เมื่อเริ่ม touch (สำหรับทั้งการแตะและลาก)
   */
  const handleTouchStartItem = useCallback(
    (e: TouchEvent, item: FileData): void => {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchItemRef.current = item;
      startLongPress(item._id);
    },
    [startLongPress]
  );

  /**
   * เมื่อ finger เคลื่อนที่ (touch move)
   */
  const handleTouchMove = useCallback(
    (e: TouchEvent): void => {
      if (!touchStartRef.current) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const dx = currentX - touchStartRef.current.x;
      const dy = currentY - touchStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > DRAG_THRESHOLD) {
        clearLongPress();
        if (!touchDragData && touchItemRef.current) {
          let dragData: DragItem | DragItem[];
          if (selectionMode && selectedItems.has(touchItemRef.current._id)) {
            dragData = Array.from(selectedItems)
              .map((id) => {
                const selectedItem = items.find((i) => i._id === id);
                return selectedItem
                  ? {
                      sourceId: selectedItem._id,
                      fileType: selectedItem.fileType,
                      fileName: selectedItem.fileName,
                      currentFolderPath: selectedItem.folderPath || "",
                    }
                  : null;
              })
              .filter((item): item is DragItem => item !== null);
          } else {
            dragData = {
              sourceId: touchItemRef.current._id,
              fileType: touchItemRef.current.fileType,
              fileName: touchItemRef.current.fileName,
              currentFolderPath: folderPath,
            };
          }
          setTouchDragData(dragData);
        }
        const touch = e.touches[0];
        const elem = document.elementFromPoint(touch.clientX, touch.clientY);
        if (elem) {
          const folderId = elem.getAttribute("data-folder-id");
          setDragOverFolderId(folderId);
        }
      }
    },
    [touchDragData, selectionMode, selectedItems, items, folderPath, clearLongPress]
  );

  /**
   * เมื่อเลิก touch
   */
  const handleTouchEnd = useCallback(
    (): void => {
      clearLongPress();
      if (touchDragData && dragOverFolderId) {
        const targetFolder = items.find(
          (item) => item._id === dragOverFolderId && item.fileType === "folder"
        );
        if (targetFolder) {
          const destination = folderPath
            ? `${folderPath}/${targetFolder.fileName}`
            : targetFolder.fileName;
          moveItems(touchDragData, destination).then(() => {
            if (refreshFiles) refreshFiles();
          });
        }
      }
      setTouchDragData(null);
      touchStartRef.current = null;
      touchItemRef.current = null;
      setDragOverFolderId(null);
    },
    [touchDragData, dragOverFolderId, items, folderPath, moveItems, refreshFiles, clearLongPress]
  );
  // ----- สิ้นสุดส่วน touch events -----

  // ส่วน mouse events สำหรับ long press
  const handleMouseDown = useCallback(
    (e: MouseEvent, itemId: string): void => {
      startLongPress(itemId);
    },
    [startLongPress]
  );

  const handleMouseUp = useCallback((): void => {
    clearLongPress();
  }, [clearLongPress]);

  useEffect(() => {
    const handleClickOutside = (event: Event): void => {
      if (openDropdown) {
        const containerElement = dropdownContainerRefs.current[openDropdown];
        if (containerElement && !containerElement.contains(event.target as Node)) {
          setOpenDropdown(null);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdown]);

  return (
    <div>
      {/* แสดงแถบเมนูสำหรับโหมดเลือกหลายรายการ */}
      {selectionMode && (
        <div className="text-sm text-gray-800 font-semibold mb-2 p-4 bg-blue-100 rounded-md flex flex-wrap justify-between items-center">
          <span>{selectedItems.size} รายการถูกเลือก</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDeleteSelected}
              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-400"
              type="button"
            >
              ลบ
            </button>
            <button
              onClick={cancelSelection}
              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-400"
              type="button"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 p-2 bg-white rounded-md shadow-md">
        <ul>
          {items.map((item) => {
            const isSelected = selectedItems.has(item._id);
            // กำหนด icon ตามประเภทของไฟล์หรือโฟลเดอร์
            const icon =
              item.fileType === "folder"
                ? "/icons/folder-icon.png"
                : item.fileType.startsWith("image/") && item.isSecret
                ? getFileIcon(item.fileType, true) || ""
                : item.fileType.startsWith("image/") && item.filePath
                ? item.filePath
                : getFileIcon(item.fileType);
            // ถ้า item เป็น folder ให้เพิ่ม drop event handlers (สำหรับ desktop)
            const dropHandlers =
              item.fileType === "folder"
                ? {
                    onDragOver: (e: DragEvent) => {
                      e.preventDefault();
                    },
                    onDragEnter: (e: DragEvent) =>
                      handleDragEnterFolder(e, item._id),
                    onDragLeave: (e: DragEvent) =>
                      handleDragLeaveFolder(e, item._id),
                    onDrop: (e: DragEvent) => handleDropOnFolder(e, item),
                  }
                : {};
            return (
              <li
                key={item._id}
                className={`border-b p-2 last:border-0 flex items-center justify-between cursor-pointer ${
                  isSelected ? "bg-blue-50" : "hover:bg-gray-100"
                } ${dragOverFolderId === item._id ? "bg-blue-200" : ""}`}
                // กำหนด draggable ให้กับรายการทั้งหมดเมื่ออยู่ในโหมดเลือก หรือถ้าไม่อยู่ในโหมดเลือก ให้ draggable สำหรับโฟลเดอร์เท่านั้น
                draggable={selectionMode || item.fileType === "folder"}
                onDragStart={(e) => handleDragStart(e, item)}
                onMouseDown={(e) => handleMouseDown(e, item._id)}
                onMouseUp={handleMouseUp}
                onTouchStart={(e) => handleTouchStartItem(e, item)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={() => handleItemClick(item)}
                // สำหรับโฟลเดอร์ ให้เพิ่ม attribute เพื่อระบุ id สำหรับตรวจสอบใน touch move
                {...(item.fileType === "folder" ? { "data-folder-id": item._id } : {})}
                {...dropHandlers}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {icon ? (
                    <Image
                    src={icon}
                    alt={item.fileName}
                    width={40}
                    height={40}
                    style={{
                      width: "40px",
                      height: "40px",
                      objectFit: "contain",
                    }}
                    className="rounded-md"
                  />                  
                  ) : (
                    <div className="w-10 h-10 bg-gray-300 rounded-md" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium truncate whitespace-nowrap overflow-hidden text-ellipsis"
                      dangerouslySetInnerHTML={{
                        __html: item.isSecret
                          ? `<span class="text-red-500">(ลับ)</span> ${item.fileName}`
                          : item.fileName,
                      }}
                    />
                    <p className="text-gray-500 text-sm">
                      {(() => {
                        if (!item.updatedAt) return "N/A";
                        const d = new Date(item.updatedAt);
                        return isNaN(d.getTime())
                          ? "N/A"
                          : new Intl.DateTimeFormat("th-TH", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "Asia/Bangkok",
                            }).format(d);
                      })()}
                    </p>
                  </div>
                </div>

                {!selectionMode && (
                  <div
                    ref={(el) => {
                      dropdownContainerRefs.current[item._id] = el;
                    }}
                    className="relative ml-4"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdown((prevId) =>
                          prevId === item._id ? null : item._id
                        );
                      }}
                      className="bg-blue-500 text-white px-2.5 py-1 rounded-md hover:bg-blue-600"
                      type="button"
                    >
                      ☰
                    </button>
                    {openDropdown === item._id && (
                      <div
                        id={`dropdown-${item._id}`}
                        className="absolute right-0 mt-2 w-36 bg-white border rounded-md shadow-lg z-20"
                      >
                        {item.fileType === "folder" ? (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateFolder(item);
                                setOpenDropdown(null);
                              }}
                              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                              type="button"
                            >
                              เปิดโฟลเดอร์
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShareFolder(item.fileName);
                                setOpenDropdown(null);
                              }}
                              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                              type="button"
                            >
                              แชร์โฟลเดอร์
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const fullFolderPath = folderPath
                                  ? `${folderPath}/${item.fileName}`
                                  : item.fileName;
                                handleDeleteFolder(fullFolderPath);
                                setOpenDropdown(null);
                              }}
                              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                              type="button"
                            >
                              ลบโฟลเดอร์
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openMediaFile(item);
                                setOpenDropdown(null);
                              }}
                              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                              type="button"
                            >
                              เปิดไฟล์
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShareFile(item);
                                setOpenDropdown(null);
                              }}
                              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                              type="button"
                            >
                              แชร์ไฟล์
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFile(item._id);
                                setOpenDropdown(null);
                              }}
                              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                              type="button"
                            >
                              ลบไฟล์
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selectionMode && (
                  <div className="ml-4">
                    {isSelected ? (
                      <span className="px-2 py-1 bg-blue-500 text-white rounded-md">
                        เลือกแล้ว
                      </span>
                    ) : (
                      <span className="px-2 py-1 border border-blue-500 text-blue-500 rounded-md">
                        เลือก
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default DriveFileListMultiSelect;