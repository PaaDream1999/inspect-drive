// inspect-drive\src\app\error\file-not-found\page.tsx

"use client";

export default function NotFound401() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="p-6 bg-white rounded-md shadow-md text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">File not found</h1>
        <p className="text-lg text-gray-700">
          ไม่พบไฟล์
        </p>
      </div>
    </div>
  );
}

