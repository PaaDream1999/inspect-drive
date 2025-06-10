// inspect-drive/src/app/deptshare/page.tsx

import "@/models/File";
import React from "react";
import dbConnect from "@/lib/dbConnect";
import SharedFile from "@/models/SharedFile";
import { z } from "zod";
import DepartmentColumn from "@/components/DepartmentColumn";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/authOptions";
import DepartmentModel, { IDepartment } from "@/models/Department";

const normalize = (v: unknown): string => String(v ?? "").trim().toLowerCase();

const ownerSchema = z
  .object({
    department: z.string().transform(normalize),
    username: z.string().optional().default(""),
  })
  .optional()
  .default({ department: "", username: "" });

const fileDetailsSchema = z.object({
  owner: ownerSchema,
  fileName: z.string().default("Unnamed File"),
  fileType: z.string().default("application/octet-stream"),
  filePath: z.string().default("/icons/file-icon.png"),
});

const fileSchema = z.object({
  _id: z.string(),
  owner: ownerSchema,
  file: fileDetailsSchema,
  shareOption: z.enum(["public", "department"]),
  isFolder: z.boolean(),
  folderPath: z.string().optional().default(""),
  createdAt: z.string(),
  sharedWithDepartments: z.array(z.string()).default([]),
  isPinned: z.boolean().default(false),
  pinnedAt: z.string().nullable().default(null),
});

const sharedFileSchema = z.array(fileSchema);
export type ValidSharedFile = z.infer<typeof fileSchema>;

interface RawOwner {
  department?: unknown;
  username?: unknown;
}

interface RawFile {
  owner?: RawOwner;
  fileName?: unknown;
  fileType?: unknown;
  filePath?: unknown;
}

function serializeSharedFiles(raw: unknown[]): unknown[] {
  return raw.map((item) => {
    const sf = item as Record<string, unknown>;
    const base: Record<string, unknown> = {
      _id: String(sf._id),
      shareOption: sf.shareOption,
      isFolder: Boolean(sf.isFolder),
      folderPath: String(sf.folderPath ?? ""),
      createdAt: sf.createdAt instanceof Date ? sf.createdAt.toISOString() : String(sf.createdAt),
      sharedWithDepartments: Array.isArray(sf.sharedWithDepartments)
        ? sf.sharedWithDepartments.map(String)
        : [],
      isPinned: Boolean(sf.isPinned),
      pinnedAt:
        sf.pinnedAt instanceof Date
          ? sf.pinnedAt.toISOString()
          : sf.pinnedAt
          ? String(sf.pinnedAt)
          : null,
    };

    if (sf.owner && typeof sf.owner === "object") {
      const o = sf.owner as RawOwner;
      base.owner = {
        department: String(o.department ?? ""),
        username: String(o.username ?? ""),
      };
    }

    const f = sf.file as RawFile | undefined;
    const fileOwner: RawOwner =
      f?.owner && typeof f.owner === "object"
        ? {
            department: String((f.owner as RawOwner).department ?? ""),
            username: String((f.owner as RawOwner).username ?? ""),
          }
        : { department: "", username: "" };

    base.file = {
      owner: fileOwner,
      fileName: f?.fileName ? String(f.fileName) : "Unnamed File",
      fileType: f?.fileType ? String(f.fileType) : "application/octet-stream",
      filePath: f?.filePath ? String(f.filePath) : "/icons/file-icon.png",
    };

    return base;
  });
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DeptSharePage() {
  await dbConnect();

  const sess = (await getServerSession(authOptions)) as {
    user?: { department?: unknown };
  } | null;

  const isLoggedIn = Boolean(sess?.user);
  const rawUserDeptId = String(sess?.user?.department ?? "");

  const rawDepts = await DepartmentModel.find().lean<IDepartment[]>();
  const idToNameMap = new Map<string, string>();
  const departmentNames: string[] = [];

  rawDepts.forEach((d) => {
    const name = normalize(d.name);
    idToNameMap.set(String(d._id), name);
    departmentNames.push(name);
  });

  const publicQuery = SharedFile.find({ shareOption: "public" })
    .populate("owner", "department username")
    .populate({
      path: "file",
      select: "fileName fileType filePath owner",
      populate: { path: "owner", select: "department username" },
    })
    .lean();

  const deptQuery = isLoggedIn
    ? SharedFile.find({
        shareOption: "department",
        sharedWithDepartments: rawUserDeptId,
      })
        .populate("owner", "department username")
        .populate({
          path: "file",
          select: "fileName fileType filePath owner",
          populate: { path: "owner", select: "department username" },
        })
        .lean()
    : Promise.resolve([]);

  const [rawPublic, rawDept] = await Promise.all([publicQuery, deptQuery]);
  const allRaw = [...rawPublic, ...rawDept];
  const sharedFiles = sharedFileSchema.parse(serializeSharedFiles(allRaw));

  const publicFiles = sharedFiles.filter((sf) => sf.shareOption === "public");
  const deptFiles = isLoggedIn
    ? sharedFiles.filter((sf) => sf.shareOption === "department")
    : [];

  const grouped: Record<string, ValidSharedFile[]> = {};
  departmentNames.forEach((dn) => {
    grouped[dn] = [];
  });

  const resolveDeptKey = (idOrName: string): string =>
    idToNameMap.get(idOrName) ?? normalize(idOrName);

  publicFiles.forEach((sf) => {
    const deptKey = resolveDeptKey(String(sf.owner.department));
    if (grouped[deptKey]) grouped[deptKey].push(sf);
  });

  if (isLoggedIn) {
    deptFiles.forEach((sf) => {
      const deptKey = resolveDeptKey(String(sf.owner.department));
      if (grouped[deptKey]) grouped[deptKey].push(sf);
    });
  }

  departmentNames.forEach((dn) => {
    grouped[dn].sort((a, b) => {
      if (a.isPinned && b.isPinned) {
        return (
          new Date(b.pinnedAt || b.createdAt).getTime() -
          new Date(a.pinnedAt || a.createdAt).getTime()
        );
      }
      if (a.isPinned) return -1;
      if (b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  const visibleDepts = departmentNames.filter((dn) => grouped[dn].length > 0);
  const single = visibleDepts.length === 1;

  return (
    <div className="mx-auto p-4 max-w-[1000px]">
      <h1 className="text-2xl font-bold mb-4 text-center">🌐 สิ่งที่แผนก/กอง แชร์</h1>
      {visibleDepts.length === 0 ? (
        <p className="text-center text-gray-500">ยังไม่ได้แชร์ไฟล์หรือโฟลเดอร์ใด ๆ</p>
      ) : (
        <div
          className={
            single
              ? "w-full max-w-md mx-auto"
              : "grid grid-cols-1 md:grid-cols-2 gap-4"
          }
        >
          {visibleDepts.map((dn) => (
            <DepartmentColumn
              key={dn}
              department={dn}
              items={grouped[dn]}
              singleColumn={single}
            />
          ))}
        </div>
      )}
    </div>
  );
}
