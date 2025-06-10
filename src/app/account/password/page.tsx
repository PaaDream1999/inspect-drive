// inspect-drive/src/app/account/password/page.tsx

"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./password.module.css";

export default function ChangePasswordPage() {
  /* ---------------------------------------------------------------- *
   * hooks                                                            *
   * ---------------------------------------------------------------- */
  const router = useRouter();
  const { status } = useSession(); // เอาเฉพาะ status ไม่ใช้ session

  /* form state */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  /* redirect ถ้าไม่ได้ล็อกอิน */
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  /* ---------------------------------------------------------------- *
   * helpers                                                          *
   * ---------------------------------------------------------------- */
  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  /* หลัง submit เปลี่ยนรหัสผ่าน */
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      resetMessages();

      if (newPassword !== confirmPassword) {
        setError("รหัสผ่านใหม่ไม่ตรงกัน");
        return;
      }

      setLoading(true);

      try {
        const res = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });

        const data: { error?: string } = await res.json();

        if (!res.ok) {
          setError(data.error ?? "เกิดข้อผิดพลาด");
          return;
        }

        setSuccess("เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่");
        /* signOut ไม่ต้องรอผลลัพธ์ */
        setTimeout(() => void signOut(), 1500);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [currentPassword, newPassword, confirmPassword],
  );

  /* ---------------------------------------------------------------- *
   * render                                                           *
   * ---------------------------------------------------------------- */
  if (status === "loading") {
    return <p className="text-center text-gray-500 mt-4">กำลังตรวจสอบสถานะ...</p>;
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>เปลี่ยนรหัสผ่าน</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="currentPassword" className={styles.label}>
              รหัสผ่านเดิม
            </label>
            <input
              type="password"
              id="currentPassword"
              className={styles.input}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="newPassword" className={styles.label}>
              รหัสผ่านใหม่
            </label>
            <input
              type="password"
              id="newPassword"
              className={styles.input}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              ยืนยันรหัสผ่านใหม่
            </label>
            <input
              type="password"
              id="confirmPassword"
              className={styles.input}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
          </button>
        </form>
      </div>
    </main>
  );
}
