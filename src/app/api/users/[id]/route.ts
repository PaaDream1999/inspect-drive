// inspect-drive\Editing\inspect-drive-editing\src\app\api\users\[id]\route.ts

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/authOptions';

import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import logger from '@/lib/logger';

/* generic JSON respond - type-safe */
const respond = <T>(data: T, status = 200) => NextResponse.json<T>(data, { status });

/* guard - allow only Admin */
const requireAdmin = async () => {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'Admin') {
    return respond({ message: 'ไม่ได้รับอนุญาต' } as const, 403);
  }
  return null;
};

/* helper type for context */
type Ctx = { params: Promise<{ id: string }> };

/* GET /api/users/:id */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id))
    return respond({ message: 'UserId ไม่ถูกต้อง' } as const, 400);

  try {
    await dbConnect();
    const user = await User.findById(id).select('-passwordHash');
    return user
      ? respond(user)
      : respond({ message: 'ไม่พบผู้ใช้งาน' } as const, 404);
  } catch (e) {
    logger.error('GET /api/users/[id]', e);
    return respond({ message: 'เกิดข้อผิดพลาดจาก Server' } as const, 500);
  }
}

/* PUT /api/users/:id */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id))
    return respond({ message: 'UserId ไม่ถูกต้อง' } as const, 400);

  try {
    await dbConnect();
    const { username, email, role, department, storageQuota } = await req.json();

    const updated = await User.findByIdAndUpdate(
      id,
      { username, email, role, department, storageQuota },
      { new: true },
    ).select('-passwordHash');

    return updated
      ? respond(updated)
      : respond({ message: 'ไม่พบผู้ใช้งาน' } as const, 404);
  } catch (e) {
    logger.error('PUT /api/users/[id]', e);
    return respond({ message: 'เกิดข้อผิดพลาดจาก Server' } as const, 500);
  }
}

/* DELETE /api/users/:id */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin();
  if (auth) return auth;

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id))
    return respond({ message: 'UserId ไม่ถูกต้อง' } as const, 400);

  try {
    await dbConnect();
    const deleted = await User.findByIdAndDelete(id);
    return deleted
      ? respond({ message: 'ลบผู้ใช้งานเรียบร้อยแล้ว' } as const)
      : respond({ message: 'ไม่พบผู้ใช้งาน' } as const, 404);
  } catch (e) {
    logger.error('DELETE /api/users/[id]', e);
    return respond({ message: 'เกิดข้อผิดพลาดจาก Server' } as const, 500);
  }
}