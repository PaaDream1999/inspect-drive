// inspect-drive/src/app/api/departments/[id]/route.ts

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/authOptions';

import dbConnect from '@/lib/dbConnect';
import Department from '@/models/Department';
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

type Ctx = { params: Promise<{ id: string }> };

/* PUT */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id))
    return respond({ error: 'ID ไม่ถูกต้อง' } as const, 400);

  const { name } = (await req.json()) as { name?: unknown };
  if (typeof name !== 'string' || !name.trim())
    return respond({ error: 'ชื่อแผนก/กอง ต้องไม่ว่าง' } as const, 400);

  try {
    await dbConnect();
    const updated = await Department.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true },
    ).lean();

    return updated
      ? respond({ success: true, data: updated })
      : respond({ error: 'ไม่พบแผนก/กอง' } as const, 404);
  } catch (e) {
    logger.error(`[PUT] /api/departments/${id} – server error`, e);
    return respond({ error: 'ไม่สามารถแก้ไขแผนก/กอง ได้' } as const, 500);
  }
}

/* DELETE */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const { id } = await ctx.params;
  if (!Types.ObjectId.isValid(id))
    return respond({ error: 'ID ไม่ถูกต้อง' } as const, 400);

  try {
    await dbConnect();
    const deleted = await Department.findByIdAndDelete(id).lean();
    return deleted
      ? respond({ success: true })
      : respond({ error: 'ไม่พบแผนก/กอง' } as const, 404);
  } catch (e) {
    logger.error(`[DELETE] /api/departments/${id} – server error`, e);
    return respond({ error: 'ไม่สามารถลบแผนก/กอง ได้' } as const, 500);
  }
}