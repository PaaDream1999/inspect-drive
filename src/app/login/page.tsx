// inspect-drive\src\app\login\page.tsx

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    // เรียก signIn ของ NextAuth แบบไม่ redirect ทันที
    const res = await signIn("credentials", { redirect: false, email, password });
    if (res?.error) {
      setError("เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } else {
      router.push("/");
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>เข้าสู่ระบบ</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
            <label htmlFor="email" className={styles.label}>
              อีเมล
            </label>
            <input
              type="email"
              id="email"
              placeholder="กรอกอีเมลของคุณ"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.relative}>
            <label htmlFor="password" className={styles.label}>
              รหัสผ่าน
            </label>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              placeholder="กรอกรหัสผ่านของคุณ"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${styles.input} ${styles.inputWithPaddingRight}`}
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={styles.showButton}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.submitButton}>
            เข้าสู่ระบบ
          </button>
        </form>

        <p className={styles.registerText}>
          <a href="/forgot-password" className={styles.registerLink}>
            ลืมรหัสผ่าน
          </a>
          {" "}┃{" "}
          <a href="/register" className={styles.registerLink}>
            สมัครสมาชิก
          </a>
        </p>
      </div>
    </main>
  );
}
