// inspect-drive\src\components\Drive\ShareFolderModal.tsx

import React from "react"; // นำเข้า React
import ShareSettings from "@/components/Share/ShareSettings"; // นำเข้า ShareSettings สำหรับการแชร์โฟลเดอร์

// ประกาศ interface สำหรับ props ของ ShareFolderModal
interface ShareFolderModalProps {
  shareFolder: string; // โฟลเดอร์ที่ต้องการแชร์
  onClose: () => void; // ฟังก์ชันสำหรับปิด modal
}

// คอมโพเนนต์ ShareFolderModal สำหรับแสดง modal แชร์โฟลเดอร์
const ShareFolderModal: React.FC<ShareFolderModalProps> = ({ shareFolder, onClose }) => {
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
        {/* เรียกใช้งาน ShareSettings โดยส่ง prop folder */}
        <ShareSettings folder={shareFolder} />
      </div>
    </div>
  );
};

// ใช้ React.memo เพื่อป้องกัน re-render ที่ไม่จำเป็น
export default React.memo(ShareFolderModal);
