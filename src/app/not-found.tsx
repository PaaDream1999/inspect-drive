// inspect-drive\src\app\not-found.tsx

"use client";

import { usePathname } from "next/navigation";

export default function NotFound() {
  const pathname = usePathname();

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="p-6 bg-white rounded-md shadow-md text-center">
      <h1 className="text-2xl font-bold text-red-600 mb-4">ไม่พบหน้าที่คุณร้องขอ</h1>
      <p className="text-lg text-gray-700">
        ไม่พบ URL <span className="font-bold text-red-600">{pathname}</span> ที่คุณพิมพ์ในเซิร์ฟเวอร์นี้
      </p>
      </div>
    </div>
  );
}
