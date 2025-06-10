// inspect-drive\src\app\register\page.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./register.module.css";

interface Department {
  _id: string;
  name: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  // ดึงแผนกจาก backend
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await fetch("/api/departments");
        if (!res.ok) throw new Error("โหลดแผนก/กองล้มเหลว");
        const { departments } = await res.json();
        setDepartments(departments);
      } catch (err) {
        console.error(err);
      }
    };
    fetchDepartments();
  }, []);

  const validatePassword = (pwd: string) => {
    const minLength = 8;
    const hasLetter = /[a-zA-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    if (pwd.length < minLength) return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    if (!(hasLetter && hasNumber) && !hasSpecial)
      return "รหัสผ่านต้องมีตัวอักษรและตัวเลข หรืออักขระพิเศษ";
    return "";
  };

  const validateForm = () => {
    if (!username || !email || !password || !confirmPassword || !department) {
      return "กรุณากรอกข้อมูลให้ครบทุกช่อง";
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formError = validateForm();
    if (formError) {
      setError(formError);
      return;
    }
    const pwdError = validatePassword(password);
    if (pwdError) {
      setError(pwdError);
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านกับยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          role: "User",
          department,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "เกิดข้อผิดพลาด");
      } else {
        router.push("/register/success");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>สมัครสมาชิก</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
            <label htmlFor="username" className={styles.label}>
              ชื่อผู้ใช้
            </label>
            <input
              type="text"
              id="username"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="email" className={styles.label}>
              อีเมล
            </label>
            <input
              type="email"
              id="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className={styles.label}>
              รหัสผ่าน
            </label>
            <input
              type="password"
              id="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          <div>
            <label htmlFor="department" className={styles.label}>
              แผนก/กอง
            </label>
            <select
              id="department"
              className={styles.select}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            >
              <option value="">เลือกแผนก/กอง</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
          </button>
        </form>
        
        <p className={styles.registerText}>
          มีบัญชีแล้ว?{" "}
          <a href="/login" className={styles.registerLink}>
            เข้าสู่ระบบ
          </a>
        </p>
      </div>
    </main>
);
}
