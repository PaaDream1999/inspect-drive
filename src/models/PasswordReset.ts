// inspect-drive\src\models\PasswordReset.ts

import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPasswordReset extends Document {
  user: Types.ObjectId;
  tokenHash: string; // SHA-256 of the raw token
  expiresAt: Date;
}

const PasswordResetSchema = new Schema<IPasswordReset>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL auto-delete
  },
  { timestamps: true }
);

export default mongoose.models.PasswordReset ||
  mongoose.model<IPasswordReset>("PasswordReset", PasswordResetSchema);