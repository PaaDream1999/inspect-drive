// inspect-drive\src\components\Upload\SecretFileUpload.tsx

"use client";

import React, { memo } from "react";
import { FileLock } from "lucide-react";

interface SecretFileUploadProps {
  files: File[];
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

const SecretFileUpload = memo(({ files, onFileChange, className = "" }: SecretFileUploadProps) => {
  return (
    <div className={`flex-1 p-4 border rounded-lg ${className}`}>
      <h2 className="text-xl font-semibold mb-4 text-gray-800">อัปโหลดไฟล์ลับ</h2>
      <label
        htmlFor="secret-file-upload"
        className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition"
      >
        <FileLock className="w-10 h-10 text-gray-500" />
        <span className="mt-2 text-gray-700 text-sm">เลือกไฟล์ลับ</span>
        <input
          id="secret-file-upload"
          type="file"
          multiple
          onChange={onFileChange}
          className="hidden"
          aria-hidden="true"
        />
      </label>

      {files.length > 0 && (
        <div className="mt-3 text-sm text-gray-600 w-full">
          {files.map((file, idx) => (
            <p key={idx} className="break-all">
              - <span className="text-red-500">(ลับ)</span> {file.name}
            </p>
          ))}
        </div>
      )}
    </div>
  );
});

SecretFileUpload.displayName = "SecretFileUpload";

export default SecretFileUpload;
