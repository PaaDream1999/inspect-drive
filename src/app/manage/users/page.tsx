// inspect-drive/src/app/manage/users/page.tsx

import React, { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/authOptions";
import { redirect } from "next/navigation";
import Link from "next/link";
import StorageOverviewClient from "@/components/Manage/StorageOverviewClient";
import UserManagement from "@/components/Manage/UsersManagement";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "Admin") {
    redirect("/error/401");
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-baseline gap-2 mb-4">
        <h1 className="text-2xl font-bold">⚙️ จัดการผู้ใช้งาน</h1>
        <Link
          href="/manage/departments"
          className="text-gray-800 text-sm font-bold hover:text-blue-600"
        >
          ⚙️ จัดการแผนก/กอง
        </Link>
      </div>

      {/* Chart แสดง Storage Overview */}
      <StorageOverviewClient />

      {/* User Management Table */}
      <Suspense
        fallback={<p className="text-center text-gray-500">กำลังโหลดข้อมูล…</p>}
      >
        <div className="mb-4 p-4 bg-white rounded-md shadow">
          <UserManagement />
        </div>
      </Suspense>
    </div>
  );
}
