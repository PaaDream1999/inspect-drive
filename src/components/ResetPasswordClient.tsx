// inspect-drive\src\components\ResetPasswordClient.tsx

"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import styles from "@/app/reset-password/reset-password.module.css";

export default function ResetPasswordClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const uid = params.get("uid") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
      } else {
        setSuccess("รีเซ็ตรหัสผ่านสำเร็จ กำลังกลับไปหน้าเข้าสู่ระบบ...");
        setTimeout(() => router.push("/login"), 1500);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>ตั้งรหัสผ่านใหม่</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
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
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className={styles.label}>
              ยืนยันรหัสผ่าน
            </label>
            <input
              type="password"
              id="confirmPassword"
              className={styles.input}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? "กำลังบันทึก..." : "ตั้งรหัสผ่าน"}
          </button>
        </form>
      </div>
    </main>
  );
}
