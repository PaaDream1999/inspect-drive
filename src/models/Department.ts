// inspect-drive/src/models/Department.ts

import { Schema, Document, model, models } from 'mongoose';

/**
 * Interface ของ Department document
 */
export interface IDepartment extends Document {
  _id: string;
  name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Schema สำหรับ collection Department
 */
const DepartmentSchema: Schema<IDepartment> = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,      // ลบช่องว่างรอบขอบชื่อ
      minlength: 2,    // ขั้นต่ำ 2 ตัวอักษร
      index: true,     // สร้าง index สำหรับค้นหา
    },
  },
  {
    timestamps: true,  // สร้าง createdAt, updatedAt
    versionKey: false, // ไม่ใช้ __v
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret._id = ret._id.toString(); // ให้ _id เป็น string
        return ret;
      },
    },
  }
);

// สร้าง model หรือใช้ของเดิมถ้ามีอยู่แล้ว
export default models.Department || model<IDepartment>('Department', DepartmentSchema);
