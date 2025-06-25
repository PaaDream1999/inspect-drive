export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';

import path from 'path';
import fs   from 'fs/promises';
import mongoose, { Types } from 'mongoose';
import type { Connection } from 'mongoose';
import type { MongoClient } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/authOptions';

import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import File from '@/models/File';
import SharedFile from '@/models/SharedFile';
import logger from '@/lib/logger';

const KMS_URL = process.env.KMS_URL ?? 'http://localhost:4000';
const userDir = (uid: string) => path.join(process.cwd(), 'private', 'uploads', uid);

/* Types */
interface CreateUserBody {
  username: string;
  email: string;
  password: string;
  role?: string;
  department?: string;
  storageQuota?: number;
}
interface UpdateUserBody {
  userId: string;
  password?: string;
  [key: string]: unknown;
}
interface DeleteUserBody { userId: string }

/* Helpers */
const isReplicaSet = (conn: Connection): boolean =>
  typeof ((conn as unknown as { client: MongoClient }).client?.options?.replicaSet) === 'string';

const respond = <T>(data: T, status = 200) => NextResponse.json<T>(data, { status });

const requireAdmin = async () => {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'Admin') {
    return respond({ message: 'ไม่ได้รับอนุญาต' } as const, 403);
  }
  return null;
};

/* GET /api/users */
export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    await dbConnect();
    const users = await User.find().select('-passwordHash').lean();
    return respond({ users });
  } catch (err) {
    logger.error('GET /api/users error', err);
    return respond({ message: 'เกิดข้อผิดพลาดจาก Server' } as const, 500);
  }
}

/* POST /api/users – สมัครสมาชิก */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isAdmin = session?.user?.role === 'Admin';

    await dbConnect();
    const {
      username, email, password,
      role, department, storageQuota,
    } = (await req.json()) as CreateUserBody;

    if (!username || !email || !password) {
      return respond({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' } as const, 400);
    }

    if (await User.exists({ $or: [{ username }, { email }] })) {
      return respond({ message: 'Username หรือ Email นี้มีอยู่แล้ว' } as const, 400);
    }

    const bcrypt         = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      email,
      passwordHash: hashedPassword,
      role:         isAdmin ? role ?? 'User' : 'User',
      department:   isAdmin ? department : undefined,
      storageQuota: isAdmin ? storageQuota : undefined,
      isApproved:   false,
    });

    const plain = newUser.toObject();
    delete (plain as Record<string, unknown>).passwordHash;

    return respond(plain, 201);
  } catch (err) {
    logger.error('POST /api/users error', err);
    return respond({ message: 'เกิดข้อผิดพลาดจาก Server' } as const, 500);
  }
}

/* PUT /api/users */
export async function PUT(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    await dbConnect();
    const { userId, password, ...rest } = (await req.json()) as UpdateUserBody;

    if (!Types.ObjectId.isValid(userId)) {
      return respond({ message: 'UserId ไม่ถูกต้อง' } as const, 400);
    }

    const update: Record<string, unknown> = { ...rest };
    if (password) {
      const bcrypt = await import('bcryptjs');
      update.passwordHash = await bcrypt.hash(password, 10);
    }

    const updated = await User.findByIdAndUpdate(userId, update, { new: true })
                              .select('-passwordHash');

    return updated
      ? respond(updated)
      : respond({ message: 'ไม่พบผู้ใช้งาน' } as const, 404);
  } catch (err) {
    logger.error('PUT /api/users error', err);
    return respond({ message: 'เกิดข้อผิดพลาดจาก Server' } as const, 500);
  }
}

/* DELETE /api/users */
export async function DELETE(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    await dbConnect();
    const { userId } = (await req.json()) as DeleteUserBody;

    if (!Types.ObjectId.isValid(userId)) {
      return respond({ message: 'UserId ไม่ถูกต้อง' } as const, 400);
    }

    const conn    = mongoose.connection;
    const session = isReplicaSet(conn) ? await mongoose.startSession() : null;
    if (session) session.startTransaction();

    const opts = session ? { session } : undefined;

    try {
      const deletedUser = await User.findByIdAndDelete(userId, opts);
      if (!deletedUser) throw new Error(`User ${userId} ไม่พบในระบบ`);

      const files      = await File.find({ owner: userId }, null, opts).lean();
      const dataKeyIds = files.map(f => f?.secretDK?.dataKeyId).filter(Boolean) as string[];

      await Promise.all([
        File.deleteMany({ owner: userId }, opts),
        SharedFile.deleteMany({ owner: userId }, opts),
      ]);

      if (session) { await session.commitTransaction(); session.endSession(); }

      await fs.rm(userDir(userId), { recursive: true, force: true })
              .catch(e => logger.warn(`ลบโฟลเดอร์ ${userDir(userId)} ไม่สำเร็จ`, e));

      await Promise.allSettled(
        dataKeyIds.map(dk => fetch(`${KMS_URL}/keys/${dk}`, { method: 'DELETE' })),
      );

      return respond({
        message: `ลบผู้ใช้ ${userId} และข้อมูลทั้งหมดเรียบร้อย`,
        deletedKeys: dataKeyIds.length,
        transaction: Boolean(session),
      });
    } catch (txErr) {
      if (session) { await session.abortTransaction(); session.endSession(); }
      logger.error('DELETE /api/users rollback', txErr);
      return respond({ message: (txErr as Error).message }, 500);
    }
  } catch (err) {
    logger.error('DELETE /api/users fatal', err);
    return respond({ message: 'เกิดข้อผิดพลาดจาก Server' } as const, 500);
  }
}