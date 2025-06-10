// inspect-drive\src\app\forgot-password\page.tsx

"use client";

import { useState } from "react";
import styles from "./forgot-password.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "เกิดข้อผิดพลาด");
      } else {
        setMessage("ถ้ามีบัญชีนี้ เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมล");
      }
    } catch {
      setError("เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>ลืมรหัสผ่าน</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
            <label htmlFor="email" className={styles.label}>อีเมล</label>
            <input
              type="email"
              id="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {message && <p className={styles.success}>{message}</p>}

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
          </button>
        </form>

        <p className={styles.forgotPasswordText}>
          ไม่ได้ลืมรหัสผ่าน?{" "}
          <a href="/login" className={styles.forgotPasswordLink}>
            เข้าสู่ระบบ
          </a>
        </p>
      </div>
    </main>
  );
}