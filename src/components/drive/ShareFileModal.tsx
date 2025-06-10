// inspect-drive\src\components\Drive\ShareFileModal.tsx

import React from "react"; // นำเข้า React
import ShareSettings from "@/components/Share/ShareSettings"; // นำเข้า ShareSettings สำหรับการแชร์ไฟล์
import { FileData } from "@/app/drive/page"; // นำเข้า interface FileData

// ประกาศ interface สำหรับ props ของ ShareFileModal
interface ShareFileModalProps {
  shareFile: FileData; // ไฟล์ที่ต้องการแชร์
  onClose: () => void; // ฟังก์ชันสำหรับปิด modal
}

// คอมโพเนนต์ ShareFileModal สำหรับแสดง modal แชร์ไฟล์
const ShareFileModal: React.FC<ShareFileModalProps> = ({ shareFile, onClose }) => {
  return (
    // container สำหรับ modal
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
      {/* box สำหรับเนื้อหา modal */}
      <div className="relative w-full max-w-[90vw] sm:max-w-[500px]">
        {/* ปุ่มปิด modal */}
        <button
          onClick={onClose}
          className="absolute right-1 text-gray-600 z-10"
        >
          ✖︎
        </button>
        {/* เรียกใช้งาน ShareSettings โดยส่ง prop file */}
        <ShareSettings file={shareFile} />
      </div>
    </div>
  );
};

// ใช้ React.memo เพื่อป้องกัน re-render ที่ไม่จำเป็น
export default React.memo(ShareFileModal);
