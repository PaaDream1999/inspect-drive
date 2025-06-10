// inspect-drive/src/models/User.ts

import mongoose, { Schema, Document, Types } from "mongoose"; // นำเข้า mongoose, Schema, Document และ Types

// กำหนด interface IUser สำหรับข้อมูลผู้ใช้ในระบบ
export interface IUser extends Document {
  username: string; // ชื่อผู้ใช้ (ต้องไม่ซ้ำ)
  email: string; // อีเมลของผู้ใช้ (ต้องไม่ซ้ำ)
  passwordHash: string; // รหัสผ่านที่ถูกเข้ารหัส
  role: "User" | "Admin"; // บทบาทของผู้ใช้ (User หรือ Admin)
  // ปรับให้ department เป็น reference ไปยัง Department collection ใน MongoDB
  department?: Types.ObjectId;
  storageQuota: number; // พื้นที่จัดเก็บไฟล์ของผู้ใช้ (GB)
  isApproved: boolean; // สถานะการอนุมัติของผู้ใช้ (true หรือ false)
}

// สร้าง Schema สำหรับ User
const UserSchema: Schema = new Schema(
  {
    username: { type: String, required: true, unique: true }, // ชื่อผู้ใช้ ต้องมีและห้ามซ้ำ
    email: { type: String, required: true, unique: true }, // อีเมล ต้องมีและห้ามซ้ำ
    passwordHash: { type: String, required: true }, // รหัสผ่านที่เข้ารหัสแล้ว ต้องมีค่า
    role: { type: String, enum: ["User", "Admin"], default: "User" }, // บทบาทของผู้ใช้ ค่าเริ่มต้นเป็น "User"
    // เปลี่ยน field department ให้เป็น ObjectId ที่อ้างอิง collection "Department"
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: false,
    },
    storageQuota: { type: Number, default: 20 }, // กำหนดพื้นที่จัดเก็บข้อมูลเริ่มต้นเป็น 20GB
    isApproved: { type: Boolean, default: false }, // สถานะการอนุมัติเริ่มต้นเป็น false
  },
  { timestamps: true } // เปิดใช้งาน timestamps เพื่อให้มี createdAt และ updatedAt อัตโนมัติ
);

// ตรวจสอบว่ามีโมเดล User อยู่แล้วหรือไม่ ถ้าไม่มีให้สร้างใหม่
export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
