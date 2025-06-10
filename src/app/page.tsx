// inspect-drive\src\app\page.tsx

"use client";

import React, { useState, useCallback, useMemo } from "react";
import FileUploader from "@/components/Upload/FileUploader";
import FolderUploader from "@/components/Upload/FolderUploader";
import SecretFileUpload from "@/components/Upload/SecretFileUpload";
import { CheckCircle, XCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./progress.module.css";
import { CloudUpload } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [files, setFiles] = useState<File[]>([]);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [secretFiles, setSecretFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<number>(0);

  // เมื่อเลือกไฟล์ปกติ
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setMessage("");
    }
  }, []);

  // เมื่อเลือกโฟลเดอร์
  const handleFolderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFolderFiles(Array.from(e.target.files));
      setMessage("");
    }
  }, []);

  // เมื่อเลือกไฟล์ลับ
  const handleSecretFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSecretFiles(Array.from(e.target.files));
      setMessage("");
    }
  }, []);

  // รวมไฟล์ทั้งหมด (เพื่อตรวจสอบว่ามีไฟล์จะอัปโหลดหรือไม่)
  const combinedFiles = useMemo(() => {
    return [...files, ...folderFiles, ...secretFiles];
  }, [files, folderFiles, secretFiles]);

  const handleUpload = useCallback(async () => {
    if (status !== "authenticated" || !session) {
      router.push("/login");
      return;
    }
    if (combinedFiles.length === 0) return;

    setIsUploading(true);
    setProgress(0);

    // เตรียม formData สำหรับไฟล์/โฟลเดอร์ปกติ
    const formData = new FormData();
    files.forEach((file) => formData.append("file", file));
    folderFiles.forEach((file) => formData.append("file", file));

    // เตรียม formData สำหรับไฟล์ลับ
    const secretFormData = new FormData();
    secretFiles.forEach((file) => secretFormData.append("file", file));
    secretFormData.append("userId", session?.user?.email || "");

    try {
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const next = prev + 10;
          if (next >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return next;
        });
      }, 500);

      // อัปโหลดไฟล์/โฟลเดอร์ปกติ
      let normalUploadMessage = "";
      if (files.length > 0 || folderFiles.length > 0) {
        const normalUploadRes = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });
        if (normalUploadRes.ok) {
          await normalUploadRes.json();
          normalUploadMessage = "อัปโหลดไฟล์/โฟลเดอร์สำเร็จ";
          setFiles([]);
          setFolderFiles([]);
        } else {
          normalUploadMessage = "เกิดข้อผิดพลาดในการอัปโหลดไฟล์/โฟลเดอร์";
        }
      }

      // อัปโหลดไฟล์ลับ
      let secretUploadMessage = "";
      if (secretFiles.length > 0) {
        const secretUploadRes = await fetch("/api/files/upload-secret", {
          method: "POST",
          body: secretFormData,
        });
        if (secretUploadRes.ok) {
          // ไม่แสดง encryption key
          secretUploadMessage = "อัปโหลดไฟล์ลับสำเร็จ";
          setSecretFiles([]);
        } else {
          secretUploadMessage = "เกิดข้อผิดพลาดในการอัปโหลดไฟล์ลับ";
        }
      }

      clearInterval(progressInterval);
      setProgress(100);

      // รวมข้อความจากทั้งสองส่วน
      const finalMessage = [normalUploadMessage, secretUploadMessage].filter(Boolean).join(" | ");
      setMessage(finalMessage);
    } catch {
      setMessage("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setProgress(0);
      }, 1000);
    }
  }, [files, folderFiles, secretFiles, session, status, router, combinedFiles]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl w-full">
        <h1 className="text-4xl font-bold text-center mb-4 text-gray-800">
          Welcome to Inspect Drive
        </h1>
        <p className="text-center text-gray-600 mb-8">
          ระบบจัดเก็บและแชร์ไฟล์-โฟลเดอร์<br className="block sm:hidden" /> ที่ปลอดภัย ใช้งานง่าย
        </p>

        <div className="flex flex-col md:flex-row gap-6">
          <FileUploader files={files} onFileChange={handleFileChange} />
          <FolderUploader folderFiles={folderFiles} onFolderChange={handleFolderChange} />
          <SecretFileUpload files={secretFiles} onFileChange={handleSecretFileChange} />
        </div>

        <div className="mt-6">
          <button
            onClick={handleUpload}
            disabled={combinedFiles.length === 0 || isUploading}
            className={`w-full flex items-center justify-center gap-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <CloudUpload />
            {isUploading ? "กำลังอัปโหลด..." : "อัปโหลด"}
          </button>

          {isUploading && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className={`${styles.progressBar} ${styles[`width-${progress}`]}`}></div>
              </div>
              <p className="text-sm text-gray-600 text-center mt-1">{progress}%</p>
            </div>
          )}
        </div>

        {message && (
          <div className="mt-4 flex items-center justify-center text-sm font-medium text-gray-700">
            {message.includes("สำเร็จ") ? (
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 mr-2" />
            )}
            {message}
          </div>
        )}
      </div>
    </main>
  );
}
