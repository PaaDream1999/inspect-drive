// inspect-drive/src/app/api/files/storage/overview/route.ts

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import checkDiskSpace from 'check-disk-space';

interface OverviewResponse {
  allocated: number; // GB (sum of all users' quotas)
  freeDisk: number;  // GB (remaining space = real free – total quota)
  totalDisk: number; // GB (total disk capacity)
}

export async function GET(): Promise<NextResponse> {
  try {
    await dbConnect();

    // รวมโควต้าทั้งหมด (GB)
    const users = await User.find()
      .select('storageQuota')
      .lean<{ storageQuota?: number }[]>();
    const totalQuota = users.reduce(
      (sum, u) => sum + (u.storageQuota ?? 0),
      0,
    );
    const allocatedGB = Number(totalQuota.toFixed(2));

    // ตรวจสอบ disk space จริง
    const diskPath = process.env.STORAGE_PATH || process.cwd();
    const { size, free } = await checkDiskSpace(diskPath);

    const totalDiskGB = Number((size / 1024 ** 3).toFixed(2));
    const freeActualGB = Number((free / 1024 ** 3).toFixed(2));

    // คำนวณ freeDisk = พื้นที่ว่างจริง – โควต้ารวม
    const freeDiskGB = Number((freeActualGB - allocatedGB).toFixed(2));

    const payload: OverviewResponse = {
      allocated: allocatedGB,
      freeDisk: freeDiskGB,
      totalDisk: totalDiskGB,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error('GET /api/files/storage/overview error:', err);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
