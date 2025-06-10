// inspect-drive/src/models/File.ts

import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Interface สำหรับข้อมูล secretDK ของไฟล์ลับ
 */
export interface ISecretDK {
  readonly dataKeyId: string; // ค่า id จาก Key-Management-Service
  readonly encryptedDK: string; // ค่าที่เข้ารหัสของ Data Key (base64)
  readonly iv: string; // Initialization Vector (hex)
  readonly dkHash: string; // Hash ของ plaintext Data Key (hex)
  readonly keyVersion: string; // เวอร์ชันของ Master Key เช่น 'v1'
}

/**
 * Interface สำหรับ File model
 */
export interface IFile extends Document {
  owner: Types.ObjectId | string;
  folderPath: string;
  fileName: string;
  fileType: string;
  filePath: string;
  fileSize: number;
  isSecret?: boolean;
  secretDK?: ISecretDK;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Schema สำหรับ secretDK
 */
const SecretDKSchema: Schema<ISecretDK> = new Schema(
  {
    dataKeyId: { type: String, required: true },
    encryptedDK: { type: String, required: true },
    iv: { type: String, required: true },
    dkHash: { type: String, required: true },
    keyVersion: { type: String, required: true },
  },
  { _id: false }
);

/**
 * FileSchema สำหรับ File model
 */
const FileSchema: Schema<IFile> = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    folderPath: { type: String, default: '', index: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true, index: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number, required: true },
    isSecret: { type: Boolean, default: false },
    secretDK: { type: SecretDKSchema },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret._id = String(ret._id);

        const updated = new Date(ret.updatedAt);
        ret.updatedAt = !isNaN(updated.getTime()) ? updated.toISOString() : null;

        delete ret.createdAt;
        return ret;
      },
    },
  }
);

/**
 * Indexes เพื่อประสิทธิภาพในการ query ที่ใช้จริง
 */

// สำหรับการค้นหาโฟลเดอร์และไฟล์ภายใต้ owner
FileSchema.index({ owner: 1, folderPath: 1 });

// สำหรับการ sort ไฟล์ตาม updatedAt โดยเฉพาะใน /api/files/list
FileSchema.index({ owner: 1, updatedAt: -1 });

export default mongoose.models.File || mongoose.model<IFile>('File', FileSchema);

