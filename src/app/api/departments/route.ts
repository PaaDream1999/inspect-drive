// inspect-drive/src/app/api/departments/route.ts

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { Types } from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/authOptions';

import dbConnect from '@/lib/dbConnect';
import Department from '@/models/Department';
import User from '@/models/User';
import logger from '@/lib/logger';

/* generic JSON respond - type-safe */
const respond = <T>(data: T, status = 200) =>
  NextResponse.json<T>(data, { status });

/* guard - allow only Admin */
const requireAdmin = async () => {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'Admin') {
    return respond({ message: 'ไม่ได้รับอนุญาต' } as const, 403);
  }
  return null;
};

/* GET /api/departments
   ไม่เช็ค Session ทุกคนสามารถดูรายชื่อแผนก/กอง ได้ */
export async function GET() {
  logger.debug('[GET] /api/departments - start');
  try {
    await dbConnect();

    const [depts, counts] = await Promise.all([
      Department.find().select({ name: 1 }).lean<
        { _id: Types.ObjectId; name: string }[]
      >(),
      User.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { department: { $ne: null } } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
      ]),
    ]);

    const map = new Map(counts.map((c) => [c._id.toHexString(), c.count]));
    const merged = depts.map((d) => ({
      _id: d._id.toHexString(),
      name: d.name,
      userCount: map.get(d._id.toHexString()) ?? 0,
    }));

    logger.info(`[GET] /api/departments - ok (${merged.length})`);
    return respond({ success: true, departments: merged });
  } catch (e) {
    logger.error('[GET] /api/departments - server error', e);
    return respond(
      { error: 'ไม่สามารถโหลดข้อมูลแผนก/กอง ได้ กรุณาลองใหม่อีกครั้ง' } as const,
      500
    );
  }
}

/* POST /api/departments
   เช็คเฉพาะ POST ว่าต้องเป็น Admin เท่านั้น */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  logger.debug('[POST] /api/departments - start');
  try {
    await dbConnect();
    const { name: raw } = (await req.json()) as { name?: unknown };
    const name = typeof raw === 'string' ? raw.trim() : '';

    if (name.length < 2)
      return respond(
        { error: 'ชื่อแผนก/กอง ต้องมีอย่างน้อย 2 ตัวอักษร' } as const,
        400
      );

    if (await Department.exists({ name }))
      return respond(
        { error: 'แผนก/กอง นี้มีอยู่แล้ว' } as const,
        409
      );

    const dep = await Department.create({ name });
    logger.info(`[POST] /api/departments - created ${dep._id}`);
    return respond({ success: true, data: dep }, 201);
  } catch (e) {
    if (e instanceof Error && 'errors' in e)
      return respond({ error: 'ข้อมูลไม่ถูกต้อง' } as const, 400);

    logger.error('[POST] /api/departments - server error', e);
    return respond(
      { error: 'ไม่สามารถสร้างแผนก/กอง ได้ กรุณาลองใหม่อีกครั้ง' } as const,
      500
    );
  }
}