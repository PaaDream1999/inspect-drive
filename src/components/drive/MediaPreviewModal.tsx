// inspect-drive/src/components/Drive/MediaPreviewModal.tsx

"use client";

import React, {
  useRef,
  useState,
  useLayoutEffect,
  useEffect,
} from "react";
import { FileData } from "@/app/drive/page";
import TextFileViewer from "@/components/Share/TextFileViewer";
import Image from "next/image";

interface MediaPreviewModalProps {
  selectedFile: FileData;
  mediaMode: "image" | "video" | null;
  handlePrev: () => void;
  handleNext: () => void;
  onClose: () => void;
}

const NavigationButtons: React.FC<{
  onPrev: () => void;
  onNext: () => void;
  children: React.ReactNode;
}> = ({ onPrev, onNext, children }) => (
  <div className="relative flex items-center justify-center w-full">
    <button
      type="button"
      onClick={onPrev}
      aria-label="Previous media"
      className="absolute left-4 font-black opacity-50 hover:opacity-75 z-10"
    >
      ◀
    </button>
    {children}
    <button
      type="button"
      onClick={onNext}
      aria-label="Next media"
      className="absolute right-4 font-black opacity-50 hover:opacity-75 z-10"
    >
      ▶
    </button>
  </div>
);

const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  selectedFile,
  mediaMode,
  handlePrev,
  handleNext,
  onClose,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasScrollbar, setHasScrollbar] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const check = () => {
      setHasScrollbar(el.scrollHeight > el.clientHeight);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedFile]);

  const renderContent = () => {
    if (selectedFile.isSecret) {
      return (
        <div className="p-6 text-center">
          <p className="text-gray-500 text-md">
            ไม่สามารถแสดงตัวอย่างไฟล์ลับได้เนื่องจากไฟล์ถูกเข้ารหัส
          </p>
        </div>
      );
    }
    if (mediaMode === "image") {
      return (
        <NavigationButtons onPrev={handlePrev} onNext={handleNext}>
          <Image
            src={selectedFile.filePath ?? ""}
            alt={selectedFile.fileName}
            width={600}
            height={400}
            className="max-w-full max-h-[80vh] object-contain"
          />
        </NavigationButtons>
      );
    }
    if (mediaMode === "video") {
      return (
        <NavigationButtons onPrev={handlePrev} onNext={handleNext}>
          <video
            controls
            preload="metadata"
            className="max-w-full max-h-[80vh] object-contain"
          >
            <source
              src={selectedFile.filePath ?? ""}
              type={selectedFile.fileType}
            />
            Your browser does not support the video tag.
          </video>
        </NavigationButtons>
      );
    }
    if (selectedFile.fileType.startsWith("audio/")) {
      return (
        <div className="flex justify-center items-center w-full p-4">
          <audio controls className="w-full max-w-md" preload="metadata">
            <source
              src={selectedFile.filePath ?? ""}
              type={selectedFile.fileType}
            />
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }
    if (selectedFile.fileType.includes("pdf")) {
      const pdfPreviewUrl = (selectedFile.filePath ?? "").replace(
        "/api/files/download",
        "/api/files/pdf-preview"
      );
      return (
        <iframe
          src={pdfPreviewUrl}
          title={selectedFile.fileName}
          className="w-full h-[80vh] border rounded-md shadow-md"
        />
      );
    }
    if (selectedFile.fileType.startsWith("text/")) {
      return (
        <div className="w-full flex-1 overflow-auto">
          <TextFileViewer filePath={selectedFile.filePath ?? ""} />
        </div>
      );
    }
    return (
      <p className="text-gray-600 text-center p-4">
        ไม่สามารถแสดงตัวอย่างไฟล์นี้ได้
      </p>
    );
  };

  return (
    <div
      key={selectedFile._id}
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50"
    >
      <div className="relative w-full max-w-[90vw] sm:max-w-[600px] bg-white rounded-lg shadow-lg flex flex-col">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className={`absolute top-0.5 ${
            hasScrollbar ? "right-3.5" : "right-2"
          } text-gray-600 z-10`}
        >
          ✖︎
        </button>

        <div
          ref={contentRef}
          className="modal-content py-6 px-6 w-full flex flex-col items-center max-h-[90vh] overflow-auto rounded-tr-lg rounded-br-lg"
          style={{
            paddingRight: hasScrollbar
              ? "calc(1.5rem - 8px)"
              : undefined,
          }}
        >
          <h2 className="text-xl font-bold mb-4 text-center break-all w-full">
            {selectedFile.isSecret && (
              <span className="text-red-500">(ลับ)</span>
            )}{" "}
            {selectedFile.fileName}
          </h2>
          {renderContent()}
        </div>
      </div>

      <style jsx global>{`
        .modal-content::-webkit-scrollbar {
          width: 8px;
        }
        /* track โค้งทุกมุม แต่ container โค้งเฉพาะขวา */
        .modal-content::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 0.5rem;
        }
        /* thumb โค้งทุกมุม */
        .modal-content::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.2);
          border-radius: 0.5rem;
        }
        /* Firefox */
        .modal-content {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
        }
      `}</style>
    </div>
  );
};

export default React.memo(MediaPreviewModal);
