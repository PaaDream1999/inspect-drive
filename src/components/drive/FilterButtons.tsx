// inspect-drive\src\components\Drive\FilterButtons.tsx

import React from "react"; // นำเข้า React

// ประกาศ interface สำหรับ props ของ FilterButtons
interface FilterButtonsProps {
  filter: string; // ค่าของ filter ที่เลือกอยู่
  setFilter: (value: string) => void; // ฟังก์ชันสำหรับเปลี่ยน filter
}

// กำหนดตัวเลือก filter ที่ใช้ในปุ่ม
const filterOptions = [
  { key: "all", label: "ทั้งหมด" },
  { key: "folder", label: "โฟลเดอร์" },
  { key: "images", label: "รูปภาพ" },
  { key: "audio", label: "เสียง" },
  { key: "videos", label: "วิดีโอ" },
  { key: "text", label: "ข้อความ" },
  { key: "pdf", label: "PDF" },
  { key: "word", label: "Word" },
  { key: "excel", label: "Excel" },
  { key: "powerpoint", label: "PowerPoint" },
  { key: "zip", label: "Zip" },
];

// คอมโพเนนต์ FilterButtons แสดงปุ่มเลือก filter
const FilterButtons: React.FC<FilterButtonsProps> = ({ filter, setFilter }) => {
  return (
    // div ครอบกลุ่มปุ่ม filter
    <div className="mb-4 flex flex-wrap gap-2">
      {filterOptions.map((btn) => (
        // แสดงปุ่มสำหรับแต่ละตัวเลือกใน filterOptions
        <button
          key={btn.key} // กำหนด key ให้กับแต่ละปุ่ม
          onClick={() => setFilter(btn.key)} // เมื่อคลิก เปลี่ยนค่า filter
          className={`px-3 py-1 rounded-md shadow-md ${
            filter === btn.key ? "bg-blue-500 text-white" : "bg-gray-100"
          }`} // กำหนด class ตามสถานะ filter ที่เลือก
        >
          {btn.label} {/* แสดง label ของตัวเลือก */}
        </button>
      ))}
    </div>
  );
};

// ใช้ React.memo เพื่อป้องกัน re-render ที่ไม่จำเป็น
export default React.memo(FilterButtons);
