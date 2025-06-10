// inspect-drive/src/components/Share/DownloadButton.tsx

"use client";

import React, { useState } from "react";
import SecretDownloadModal from "./SecretDownloadModal";
import { CloudDownload } from "lucide-react";

interface DownloadButtonProps {
  filePath: string;
  isSecret: boolean;
  fileId?: string;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({
  filePath,
  isSecret,
  fileId,
}) => {
  const [showModal, setShowModal] = useState(false);

  // หาก fileId ไม่ถูกส่งมา ให้แยกจาก filePath
  const resolvedFileId: string =
    fileId ??
    (() => {
      const match = filePath.match(/\/download\/([^?]+)/);
      return match && match[1] ? match[1] : "";
    })();

  const handleClick = () => {
    if (isSecret) {
      if (!resolvedFileId) {
        console.error("Missing fileId for secret download");
        return;
      }
      setShowModal(true);
    } else {
      window.location.href = filePath;
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 transition-colors text-white font-medium py-2 px-4 rounded-md shadow-md"
      >
        <CloudDownload className="w-5 h-5" />
        ดาวน์โหลดไฟล์
      </button>
      {showModal && (
        <SecretDownloadModal
          fileId={resolvedFileId}
          filePath={filePath}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
};

export default DownloadButton;
