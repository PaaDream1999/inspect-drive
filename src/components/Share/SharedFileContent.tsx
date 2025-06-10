// inspect-drive\src\components\Share\SharedFileContent.tsx

"use client";

import React, { memo, useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";

// Import TextFileViewer แบบ dynamic (เฉพาะเมื่อไฟล์เป็น text)
const TextFileViewer = dynamic(() => import("./TextFileViewer"), { ssr: false });

interface ISharedFileContentProps {
  fileName: string;
  fileType: string;
  filePath: string;
  isSecret?: boolean; // เพิ่ม prop สำหรับตรวจสอบว่าไฟล์เป็นลับหรือไม่
}

const SharedFileContent: React.FC<ISharedFileContentProps> = ({
  fileName,
  fileType,
  filePath,
  isSecret = false, // กำหนดค่าเริ่มต้นให้ false หากไม่ได้ส่งค่าเข้ามา
}) => {
  // เรียกใช้ hook ทุกครั้งโดยไม่คำนึงว่า isSecret เป็น true หรือไม่
  const isImage = useMemo(() => fileType.startsWith("image/"), [fileType]);
  const isVideo = useMemo(() => fileType.startsWith("video/"), [fileType]);
  const isAudio = useMemo(() => fileType.startsWith("audio/"), [fileType]);
  const isPDF = useMemo(() => fileType.includes("pdf"), [fileType]);
  const isText = useMemo(() => fileType.startsWith("text/"), [fileType]);

  // ตรวจสอบการรองรับ lazy loading สำหรับ iframe บน Safari iOS < 16.4
  const supportsLazy = useMemo(() => {
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent;
      const match = ua.match(/OS (\d+)_?(\d+)?/);
      if (match) {
        const majorVersion = parseInt(match[1], 10);
        // iOS 16 ขึ้นไปรองรับ lazy loading
        return majorVersion >= 16;
      }
    }
    return true;
  }, []);

  // ถ้าเป็นไฟล์ลับ ให้แสดงข้อความแจ้งและหยุดการ render ส่วนที่เหลือ
  if (isSecret) {
    return (
      <p className="text-gray-500 text-md text-center mt-3 mb-4">
        ไม่สามารถแสดงไฟล์ลับได้ เนื่องจากไฟล์นี้ถูกเข้ารหัส
      </p>
    );
  }

  return (
    <div className="flex justify-center items-center mt-3 mb-4">
      {isImage && (
        <Image
          src={filePath}
          alt={fileName || "Image preview"}
          className="max-w-full rounded-md shadow-md"
          width={800}
          height={600}
          quality={75}
          loading="lazy"
        />
      )}
      {isVideo && (
        <video
          controls
          className="max-w-full rounded-md shadow-md"
          preload="metadata"
        >
          <source src={filePath} type={fileType} />
          Your browser does not support the video tag.
        </video>
      )}
      {isAudio && (
        <audio controls className="w-full rounded-md" preload="metadata">
          <source src={filePath} type={fileType} />
          Your browser does not support the audio element.
        </audio>
      )}
      {isPDF &&
        (() => {
          const pdfPreviewUrl = filePath.replace(
            "/api/files/download",
            "/api/files/pdf-preview"
          );
          return (
            <iframe
              src={pdfPreviewUrl}
              title={fileName || "PDF preview"}
              className="w-full h-[80vh] border rounded-md shadow-md"
              {...(supportsLazy ? { loading: "lazy" } : {})}
            />
          );
        })()}
      {isText && <TextFileViewer filePath={filePath} />}
      {!isImage && !isVideo && !isAudio && !isPDF && !isText && (
        <p className="text-gray-500">
          ไม่สามารถแสดงตัวอย่างไฟล์นี้ได้
        </p>
      )}
    </div>
  );
};

export default memo(SharedFileContent);
