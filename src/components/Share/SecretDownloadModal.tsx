// inspect-drive/src/components/Share/SecretDownloadModal.tsx

"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FaEye, FaEyeSlash } from "react-icons/fa";

interface SecretDownloadModalProps {
  fileId: string;
  filePath: string;
  onClose: () => void;
}

const SecretDownloadModal: React.FC<SecretDownloadModalProps> = ({
  fileId,
  filePath,
  onClose,
}) => {
  const [secretKey, setSecretKey] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!secretKey.trim()) {
      setError("กรุณากรอก Secret Key");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // ดาวน์โหลดไฟล์ลับ
      const downloadRes = await fetch(`${filePath}?key=${secretKey}`);
      if (!downloadRes.ok) {
        const data = await downloadRes.json();
        setError(data.error ?? "Secret Key invalid");
        return;
      }

      // อ่านชื่อไฟล์จาก header
      const cd = downloadRes.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^;"']+)["']?/);
      const filename = match?.[1] ? decodeURIComponent(match[1]) : "downloaded_file";

      // สร้าง Blob และดาวน์โหลด
      const blob = await downloadRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // ยืนยันการดาวน์โหลด (สั่งลบ file + metadata)
      const confirmRes = await fetch(
        `/api/files/confirm-download/${fileId}?key=${secretKey}`,
        { method: "POST" }
      );
      if (!confirmRes.ok) {
        console.error("Confirm download failed:", await confirmRes.text());
      }

      router.push("/share/download-success");
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการดาวน์โหลด");
    } finally {
      setLoading(false);
    }
  }, [fileId, filePath, secretKey, router]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
      <h2 className="text-xl font-semibold mb-4">กรอก Secret Key</h2>

      <div className="relative mb-2">
        <input
        type={showPassword ? "text" : "password"}
        value={secretKey}
        onChange={(e) => setSecretKey(e.target.value)}
        placeholder="Secret Key"
        disabled={loading}
        className="w-full pr-10 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 selection:bg-black focus:ring-black"
        />
        <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-300"
        >
        {showPassword ? <FaEyeSlash /> : <FaEye />}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

      <div className="flex justify-end space-x-2 mt-4">
        <button
        onClick={onClose}
        disabled={loading}
        className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-gray-800 disabled:opacity-50"
        >
        ยกเลิก
        </button>
        <button
        onClick={handleDownload}
        disabled={loading}
        className="px-4 py-2 bg-gray-800 rounded hover:bg-black text-white disabled:opacity-50"
        >
        {loading ? "กำลังดาวน์โหลด..." : "ยืนยัน"}
        </button>
      </div>
      </div>
    </div>
  );
};

export default SecretDownloadModal;

