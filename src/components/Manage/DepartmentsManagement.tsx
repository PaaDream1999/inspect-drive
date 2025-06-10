// inspect-drive/src/components/Manage/DepartmentsManagement.tsx

"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  FormEvent,
  useMemo,
} from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, usePathname } from "next/navigation";
import { saveAs } from "file-saver";
import Pagination from "@/components/Pagination";
import {
  useFloating,
  offset,
  flip,
  shift,
  Placement,
} from "@floating-ui/react";

/* -------------------------------------------------------------------------- */
/*                                   types                                    */
/* -------------------------------------------------------------------------- */

interface Department {
  _id: string;
  name: string;
  userCount: number;
}

interface DepartmentRowProps {
  dept: Department;
  editDeptId: string | null;
  editDeptName: string;
  loading: boolean;
  onEdit: (dept: Department) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
  setEditDeptName: (name: string) => void;
}

/* -------------------------------------------------------------------------- */
/*                              TABLE ROW COMPONENT                           */
/* -------------------------------------------------------------------------- */

const DepartmentRow: React.FC<DepartmentRowProps> = ({
  dept,
  editDeptId,
  editDeptName,
  loading,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  setEditDeptName,
}) => {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles } = useFloating({
    placement: "bottom-end" as Placement,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
  });

  /* click-outside */
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const ref = refs.reference.current as HTMLElement | null;
      const flo = refs.floating.current as HTMLElement | null;
      if (
        ref &&
        !ref.contains(e.target as Node) &&
        flo &&
        !flo.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, refs]);

  return (
    <tr className="hover:bg-gray-50">
      {/* name */}
      <td className="px-4 py-2">
        {editDeptId === dept._id ? (
          <input
            type="text"
            value={editDeptName}
            onChange={(e) => setEditDeptName(e.target.value)}
            className="border px-2 py-1 rounded w-full"
            aria-label="แก้ไขชื่อแผนก/กอง"
            placeholder="ชื่อแผนก/กอง"
            disabled={loading}
          />
        ) : (
          dept.name
        )}
      </td>

      {/* user count */}
      <td className="px-4 py-2 text-center">{dept.userCount}</td>

      {/* action */}
      <td className="px-4 py-2 text-center">
        {editDeptId === dept._id ? (
          <div className="flex justify-center gap-2">
            <button
              onClick={onSave}
              className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
              disabled={loading}
            >
              บันทึก
            </button>
            <button
              onClick={() => {
                onCancel();
                setOpen(false);
              }}
              className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
              disabled={loading}
            >
              ยกเลิก
            </button>
          </div>
        ) : (
          <>
            <button
              ref={refs.setReference}
              onClick={() => setOpen((o) => !o)}
              className="bg-blue-500 text-white px-2.5 py-1 rounded hover:bg-blue-600"
            >
              ☰
            </button>
            {open && (
              <div
                ref={refs.setFloating}
                style={floatingStyles}
                className="z-50 w-36 rounded-md shadow-md bg-white border border-gray-200"
                role="menu"
              >
                <button
                  role="menuitem"
                  onClick={() => {
                    onEdit(dept);
                    setOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  แก้ไข
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    onDelete(dept._id);
                    setOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  ลบ
                </button>
              </div>
            )}
          </>
        )}
      </td>
    </tr>
  );
};

/* -------------------------------------------------------------------------- */
/*                               MAIN COMPONENT                               */
/* -------------------------------------------------------------------------- */

const DepartmentsManagement: React.FC = () => {
  /* always call hooks in the same order — declare ALL hooks first  */
  const { data: session, status } = useSession();

  /* local state (moved up to keep hook order stable) */
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [newDept, setNewDept] = useState("");
  const [editDeptId, setEditDeptId] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* pagination helpers */
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
  const currentPage = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const itemsPerPage = 10;

  /* data fetch */
  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/departments");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาดในการโหลดข้อมูล");
      } else {
        setDepartments(data.departments ?? []);
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  /* derived lists */
  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return departments.filter((d) => d.name.toLowerCase().includes(q));
  }, [departments, searchTerm]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const safePage =
    currentPage > totalPages && totalPages > 0 ? totalPages : currentPage;

  const paginated = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, safePage]);

  /* --------------------------- auth gate UI --------------------------- */
  if (status === "loading") return <p className="text-center py-4">กำลังโหลด…</p>;

  if (!session || session.user.role !== "Admin")
    return (
      <p className="text-center text-red-500 py-4">
        คุณไม่มีสิทธิ์เข้าถึงหน้านี้
      </p>
    );

  /* handlers */
  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const name = newDept.trim();
    if (!name) {
      setError("กรุณาระบุชื่อแผนก/กอง");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "เพิ่มแผนก/กอง ไม่สำเร็จ");
      } else {
        setNewDept("");
        fetchDepartments();
      }
    } catch {
      setError("เพิ่มแผนก/กอง ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ยืนยันการลบแผนก/กอง นี้?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "ลบแผนก/กอง ไม่สำเร็จ");
      } else {
        if (paginated.length === 1 && safePage > 1) {
          window.history.replaceState(null, "", `${pathname}?page=${safePage - 1}`);
        }
        fetchDepartments();
      }
    } catch {
      setError("ลบแผนก/กอง ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (dept: Department) => {
    setEditDeptId(dept._id);
    setEditDeptName(dept.name);
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!editDeptId) return;
    const name = editDeptName.trim();
    if (!name) {
      setError("กรุณาระบุชื่อแผนก/กอง");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/departments/${editDeptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "บันทึกแผนก/กอง ไม่สำเร็จ");
      } else {
        setEditDeptId(null);
        setEditDeptName("");
        fetchDepartments();
      }
    } catch {
      setError("บันทึกแผนก/กอง ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const bom = "\uFEFF";
    const header = "ชื่อแผนก/กอง,จำนวนผู้ใช้";
    const rows = departments.map((d) => `${d.name},${d.userCount}`);
    const total = departments.reduce((s, d) => s + d.userCount, 0);
    const csv = bom + [header, ...rows, `รวมจำนวนผู้ใช้ทั้งหมด,${total}`].join(
      "\r\n"
    );
    saveAs(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "departments.csv");
  };

  /* render */
  return (
    <div className="p-4">
      {/* controls */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-2">
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto"
        >
          <input
            type="text"
            value={newDept}
            onChange={(e) => setNewDept(e.target.value)}
            placeholder="เพิ่มแผนก/กอง ใหม่"
            aria-label="ชื่อแผนก/กอง ใหม่"
            className="border px-3 py-2 rounded flex-1 min-w-0 text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm"
            disabled={loading}
          >
            เพิ่ม
          </button>
        </form>

        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm whitespace-nowrap"
            disabled={loading}
          >
            Export CSV
          </button>
          <input
            type="text"
            placeholder="ค้นหาแผนก/กอง"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="ค้นหาแผนก/กอง"
            className="border px-3 py-2 rounded flex-1 min-w-0 text-sm"
            disabled={loading}
          />
        </div>
      </div>

      {error && <p className="text-red-500 text-center mb-4">{error}</p>}

      {/* table */}
      <div className="overflow-x-auto bg-white shadow rounded-md">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">
                ชื่อแผนก/กอง
              </th>
              <th className="px-4 py-3 text-center font-semibold">
                <span className="block sm:hidden leading-tight">
                  จำนวน<br />ผู้ใช้
                </span>
                <span className="hidden sm:inline">จำนวนผู้ใช้</span>
              </th>
              <th className="px-4 py-3 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-center text-gray-500">
                  ไม่พบข้อมูล
                </td>
              </tr>
            ) : (
              paginated.map((d) => (
                <DepartmentRow
                  key={d._id}
                  dept={d}
                  editDeptId={editDeptId}
                  editDeptName={editDeptName}
                  loading={loading}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSave={handleSaveEdit}
                  onCancel={() => setEditDeptId(null)}
                  setEditDeptName={setEditDeptName}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          searchParams={searchParams}
          pathname={pathname}
        />
      )}

      {loading && <p className="text-center text-gray-600 mt-4">กำลังโหลด…</p>}
    </div>
  );
};

export default DepartmentsManagement;
