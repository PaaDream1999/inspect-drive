// inspect-drive\src\components\Upload\FolderUploader.tsx

"use client";

import React, { memo } from "react";
import { FolderUp } from "lucide-react";

interface FolderUploaderProps {
  folderFiles: File[];
  onFolderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

const FolderUploader = memo(({ folderFiles, onFolderChange, className = "" }: FolderUploaderProps) => {
  return (
    <div className={`flex-1 p-4 border rounded-lg ${className}`}>
      <h2 className="text-xl font-semibold mb-4 text-gray-800">อัปโหลดโฟลเดอร์</h2>
      <label
        htmlFor="folder-upload"
        className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition"
      >
        <FolderUp className="w-10 h-10 text-gray-500" />
        <span className="mt-2 text-gray-700 text-sm">เลือกโฟลเดอร์</span>
        <input
          id="folder-upload"
          type="file"
          multiple
          {...({ webkitdirectory: "true" } as { webkitdirectory: string })}
          onChange={onFolderChange}
          className="hidden"
          aria-hidden="true"
        />
      </label>

      {folderFiles.length > 0 && (
        <div className="mt-3 text-sm text-gray-600 w-full">
          {folderFiles.map((file, idx) => (
            <p key={idx} className="break-all">
              - {("webkitRelativePath" in file && file.webkitRelativePath) || file.name}
            </p>
          ))}
        </div>
      )}
    </div>
  );
});

FolderUploader.displayName = "FolderUploader";

export default FolderUploader;
