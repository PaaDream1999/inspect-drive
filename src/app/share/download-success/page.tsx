// inspect-drive/src/app/share/download-success/page.tsx

"use client";

import styles from "@/app/register/register.module.css";

export default function SuccessPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="p-6 bg-white rounded-md shadow-md">
        <p className={styles.success}>
          ✅ ดาวน์โหลดไฟล์ลับเรียบร้อยแล้ว
        </p>
      </div>
    </div>
  );
}
