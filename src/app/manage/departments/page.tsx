// inspect-drive\src\app\manage\departments\page.tsx

import React, { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/authOptions";
import { redirect } from "next/navigation";
import DepartmentsManagement from "@/components/Manage/DepartmentsManagement";
import Link from "next/link";

export default async function DepartmentsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "Admin") {
    redirect("/error/401");
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-baseline gap-2 mb-4">
        <h1 className="text-2xl font-bold">⚙️ จัดการแผนก/กอง</h1>
        <Link href="/manage/users" className="text-gray-800 text-sm font-bold hover:text-blue-600">
          ⚙️ จัดการผู้ใช้งาน
        </Link>
      </div>

      <Suspense fallback={<p className="text-center text-gray-500">กำลังโหลดข้อมูล…</p>}>
        <div className="mb-4 p-4 bg-white rounded-md shadow">
          <DepartmentsManagement />
        </div>
      </Suspense>
    </div>
  );
}
