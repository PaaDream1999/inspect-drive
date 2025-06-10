// inspect-drive\src\lib\passwordUtils.ts

import crypto from "crypto";

/**
 * Validate password strength.
 * @param pwd password string
 * @returns null if valid, otherwise the error message in Thai.
 */
export function validatePassword(pwd: string): string | null {
  const minLength = 8;
  const hasLetter = /[a-zA-Z]/.test(pwd);
  const hasDigit = /[0-9]/.test(pwd);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);

  if (pwd.length < minLength) return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
  if (!(hasLetter && (hasDigit || hasSpecial))) {
    return "รหัสผ่านต้องมีตัวอักษร และตัวเลขหรืออักขระพิเศษ";
  }
  return null;
}

/**
 * Hash a reset token with SHA-256 to store safely in DB.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}