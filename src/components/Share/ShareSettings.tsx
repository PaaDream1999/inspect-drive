// inspect-drive/src/components/Share/ShareSettings.tsx

"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import type { Types } from "mongoose";
import ShareOptionRadioGroup from "./ShareOptionRadioGroup";
import DepartmentCheckboxes from "./DepartmentCheckboxes";
import { mutate } from "swr";

interface FileData {
  _id: string | Types.ObjectId;
  isSecret?: boolean;
}

interface ShareSettingsProps {
  file?: FileData | null;
  folder?: string;
}

const ShareSettings: React.FC<ShareSettingsProps> = ({ file, folder }) => {
  const [shareOption, setShareOption] = useState("private");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [shareLink, setShareLink] = useState<string>("");
  const [secretKey, setSecretKey] = useState<string>(""); // plaintextDK ที่ได้รับจาก API
  const fileIdRef = useRef(file?._id);

  const isSecret = file?.isSecret === true;

  useEffect(() => {
    if (isSecret) {
      setShareOption("secret");
    }
  }, [isSecret]);

  useEffect(() => {
    if (file) {
      fileIdRef.current = file._id;
    }
  }, [file]);

  useEffect(() => {
    if (shareOption !== "department") {
      setSelectedDepartments([]);
    }
  }, [shareOption]);

  const handleShareOptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setShareOption(e.target.value);
  }, []);

  const toggleDepartmentSelection = useCallback((dept: string) => {
    setSelectedDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (shareOption === "department" && selectedDepartments.length === 0) {
        alert("กรุณาเลือกแผนก/กอง ที่ต้องการแชร์อย่างน้อยหนึ่ง");
        return;
      }
      setLoading(true);
      try {
        const payload = folder
          ? {
              folderPath: folder,
              shareOption,
              departments: shareOption === "department" ? selectedDepartments : undefined,
              isFolder: true,
            }
          : {
              fileId: String(fileIdRef.current),
              shareOption,
              departments: shareOption === "department" ? selectedDepartments : undefined,
            };

        console.log(">> handleSubmit: payload", payload);

        const response = await fetch("/api/files/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        console.log(">> handleSubmit: response status", response.status);
        if (!response.ok) throw new Error("Failed to share file/folder");
        const data = await response.json();
        console.log(">> handleSubmit: response data", data);
        setShareLink(data.shareLink);
        if (data.plaintextDK) { // ตรวจสอบว่า API ส่ง plaintextDK กลับมาหรือไม่
          setSecretKey(data.plaintextDK);
          console.log(">> handleSubmit: plaintextDK received", data.plaintextDK);
        } else {
          console.log(">> handleSubmit: no plaintextDK in response");
        }
        mutate("/api/files/share");
      } catch (error) {
        console.error("Error sharing file/folder:", error);
        alert("เกิดข้อผิดพลาดในการแชร์ไฟล์/โฟลเดอร์");
      } finally {
        setLoading(false);
      }
    },
    [shareOption, selectedDepartments, folder]
  );

  return (
    <div className="bg-white rounded-md shadow-md p-4">
      <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
        {folder ? "ตั้งค่าการแชร์โฟลเดอร์" : "ตั้งค่าการแชร์ไฟล์"}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <p className="text-gray-700 font-medium mb-2">เลือกการแชร์:</p>
          <ShareOptionRadioGroup
            shareOption={shareOption}
            onChange={handleShareOptionChange}
            isSecret={isSecret}
          />
        </div>
        {shareOption === "department" && (
          <div>
            <p className="text-gray-700 font-medium mb-2">เลือกแผนก/กอง ที่ต้องการแชร์:</p>
            <DepartmentCheckboxes
              selectedDepartments={selectedDepartments}
              toggleDepartmentSelection={toggleDepartmentSelection}
            />
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 0116 0h2a10 10 0 00-20 0h2z"
                ></path>
              </svg>
              กำลังแชร์...
            </>
          ) : (
            "แชร์"
          )}
        </button>
      </form>
      {(shareLink || secretKey) && (
        <div className="mt-4 p-4 bg-gray-100 rounded-md">
          <p className="text-gray-700 font-medium mb-2">
            ลิงก์สำหรับเข้าถึง{folder ? "โฟลเดอร์" : "ไฟล์"}:
          </p>
          <a
            href={shareLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline break-all selection:bg-blue-500 selection:text-white"
          >
            {shareLink}
          </a>
          {secretKey && (
            <div className="mt-2">
              <p className="text-gray-700 font-medium mb-1">
                Secret Key สำหรับถอดรหัสไฟล์ลับ:
              </p>
              <p className="bg-white p-2 rounded border break-all text-gray-300 text-xs selection:bg-gray-300">
                {secretKey}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(ShareSettings);
