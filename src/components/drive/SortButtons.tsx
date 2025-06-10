// inspect-drive\src\components\Drive\SortButtons.tsx

import React from "react"; // นำเข้า React

// ประกาศ interface สำหรับ props ของ SortButtons
interface SortButtonsProps {
  sortOrder: string; // ค่าของการจัดเรียงที่เลือกอยู่
  setSortOrder: (order: string) => void; // ฟังก์ชันสำหรับเปลี่ยนการจัดเรียง
}

// คอมโพเนนต์ SortButtons แสดงปุ่มสำหรับเลือกการจัดเรียง
const SortButtons: React.FC<SortButtonsProps> = ({ sortOrder, setSortOrder }) => {
  return (
    // div ครอบปุ่มการจัดเรียง
    <div className="mb-4 flex space-x-2">
      <button
        onClick={() => setSortOrder("newToOld")} // เมื่อคลิก เปลี่ยนการจัดเรียงเป็น "ใหม่ไปเก่า"
        className={`px-3 py-1 rounded-md shadow-md ${
          sortOrder === "newToOld" ? "bg-blue-500 text-white" : "bg-gray-100"
        }`} // กำหนด class ตามสถานะของ sortOrder
      >
        ใหม่ไปเก่า {/* ข้อความบนปุ่ม */}
      </button>
      <button
        onClick={() => setSortOrder("oldToNew")} // เมื่อคลิก เปลี่ยนการจัดเรียงเป็น "เก่าไปใหม่"
        className={`px-3 py-1 rounded-md shadow-md ${
          sortOrder === "oldToNew" ? "bg-blue-500 text-white" : "bg-gray-100"
        }`} // กำหนด class ตามสถานะของ sortOrder
      >
        เก่าไปใหม่ {/* ข้อความบนปุ่ม */}
      </button>
    </div>
  );
};

// ใช้ React.memo เพื่อป้องกัน re-render ที่ไม่จำเป็น
export default React.memo(SortButtons);
