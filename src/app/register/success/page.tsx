// inspect-drive/src/app/register/success/page.tsx

"use client";

import styles from "@/app/register/register.module.css";

export default function SuccessPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="p-6 bg-white rounded-md shadow-md">
        <p className={styles.success}>
          ✅ สมัครสมาชิกเรียบร้อยแล้ว กรุณารอการอนุมัติจากผู้ดูแลระบบก่อนเข้าสู่ระบบ
        </p>
      </div>
    </div>
  );
}
