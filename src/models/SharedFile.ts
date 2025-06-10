// inspect-drive/src/models/SharedFile.ts

import mongoose, { Schema, Document, Types } from 'mongoose';
import '@/models/File';

/**
 * Interface สำหรับ SharedFile
 */
export interface ISharedFile extends Document {
  readonly _id: Types.ObjectId | string;
  readonly file?: Types.ObjectId | string;
  readonly owner: Types.ObjectId | string;
  readonly shareOption: 'private' | 'department' | 'public' | 'secret';
  readonly sharedWithDepartments?: string[];
  readonly isFolder: boolean;
  readonly folderPath: string;
  readonly fullPath?: string;
  readonly isPinned?: boolean;
  readonly pinnedAt?: Date;
  readonly plaintextDK?: string;
  readonly plaintextDKExpiresAt?: Date;
  readonly createdAt: Date;
}

/**
 * กำหนดว่า production ไม่ควร autoIndex เพื่อประสิทธิภาพ
 */
const autoIndexSetting = process.env.NODE_ENV !== 'production';

/**
 * Schema สำหรับ SharedFile
 */
const SharedFileSchema: Schema<ISharedFile> = new Schema(
  {
    file: {
      type: Schema.Types.ObjectId,
      ref: 'File',
      required: function (this: ISharedFile) {
        return !this.isFolder;
      },
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    shareOption: {
      type: String,
      enum: ['private', 'department', 'public', 'secret'],
      required: true,
      index: true,
    },
    plaintextDK: { type: String },
    plaintextDKExpiresAt: { type: Date },
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    sharedWithDepartments: {
      type: [String],
      default: [],
      validate: {
        validator: function (this: ISharedFile, value: string[]) {
          return this.shareOption === 'department'
            ? value.length > 0
            : value.length === 0;
        },
        message:
          "sharedWithDepartments should only be set when shareOption is 'department'",
      },
    },
    isFolder: { type: Boolean, required: true, default: false },
    folderPath: { type: String, default: '' },
    fullPath: { type: String, default: '' },
  },
  {
    timestamps: true,
    autoIndex: autoIndexSetting,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret._id = String(ret._id);
        return ret;
      },
    },
  }
);

/**
 * Indexes เพื่อประสิทธิภาพการ query
 */
SharedFileSchema.index({ owner: 1, shareOption: 1 });
SharedFileSchema.index({ createdAt: -1 });
SharedFileSchema.index({ sharedWithDepartments: 1 }, { sparse: true });
SharedFileSchema.index({ folderPath: 1 });
SharedFileSchema.index({ fullPath: 1 });

// เพิ่มเติมตาม pattern การใช้งานจริง
SharedFileSchema.index({ owner: 1, folderPath: 1 });
SharedFileSchema.index({ isFolder: 1, folderPath: 1 });

export default mongoose.models.SharedFile ||
  mongoose.model<ISharedFile>('SharedFile', SharedFileSchema);
