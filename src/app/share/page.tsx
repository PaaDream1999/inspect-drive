// inspect-drive/src/app/share/page.tsx

import React, { Suspense } from 'react';
import SharedList from '@/components/Share/SharedList';

export default function SharedListPage() {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold inline-block align-middle mb-4">
        🌐 สิ่งที่ฉันแชร์
      </h1>

      <Suspense fallback={<p className="text-center text-gray-500">กำลังโหลดข้อมูล…</p>}>
        <SharedList />
      </Suspense>
    </div>
  );
}
