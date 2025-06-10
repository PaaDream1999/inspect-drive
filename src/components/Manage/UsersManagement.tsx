// inspect-drive/src/components/Manage/UsersManagement.tsx

"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  ChangeEvent,
  memo,
  Fragment,
} from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, usePathname } from "next/navigation";
import Pagination from "@/components/Pagination";
import { saveAs } from "file-saver";
import {
  useFloating,
  offset,
  flip,
  shift,
  Placement,
} from "@floating-ui/react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/* -------------------------------------------------------------------------- */
/*                                 Interfaces                                 */
/* -------------------------------------------------------------------------- */

interface Department {
  _id: string;
  name: string;
}

interface User {
  _id: string;
  username: string;
  email: string;
  role: "User" | "Admin";
  department?: string;
  storageQuota: number;
  isApproved: boolean;
}

interface TableRowProps {
  user: User;
  editingUserId: string | null;
  editingUserData: Partial<User>;
  onInputChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onDelete: (id: string) => void;
  onEdit: (user: User) => void;
  onSave: () => void;
  onCancel: () => void;
  onApprove: (id: string) => void;
  availableDepartments: Department[];
}

interface ConfirmModalProps {
  open: boolean;
  username: string;
  onClose(): void;
  onConfirm(): void;
}

/* -------------------------------------------------------------------------- */
/*                               Confirm Delete Modal                         */
/* -------------------------------------------------------------------------- */

const ConfirmDeleteModal = ({
  open,
  username,
  onClose,
  onConfirm,
}: ConfirmModalProps) => {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) {
      setText("");
    }
  }, [open]);

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[1100]" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="scale-95 opacity-0"
            enterTo="scale-100 opacity-100"
            leave="ease-in duration-150"
            leaveFrom="scale-100 opacity-100"
            leaveTo="scale-95 opacity-0"
          >
            <DialogPanel className="w-full max-w-sm transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-lg">
              <DialogTitle
                as="h3"
                className="flex items-center gap-2 text-lg font-medium text-gray-600"
              >
                <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
                ยืนยันการลบผู้ใช้งาน
              </DialogTitle>
              <p className="mt-2 text-sm text-red-500">
                *การลบผู้ใช้{" "}
                <span className="font-semibold">{username}</span>{" "}
                จะลบไฟล์-โฟลเดอร์ และข้อมูลใน Database ของผู้ใช้งานทั้งหมด
              </p>
              <p className="mt-2 text-sm text-gray-600">
                พิมพ์{" "}
                <code className="font-mono font-semibold">DELETE</code>{" "}
                เพื่อยืนยัน
              </p>

              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="mt-4 w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="พิมพ์ DELETE เพื่อยืนยัน"
              />

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="rounded bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
                >
                  ยกเลิก
                </button>
                <button
                  disabled={text !== "DELETE"}
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="rounded bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  ลบถาวร
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
};
ConfirmDeleteModal.displayName = "ConfirmDeleteModal";

/* -------------------------------------------------------------------------- */
/*                              TableRow Component                            */
/* -------------------------------------------------------------------------- */

const TableRow = memo(
  ({
    user,
    editingUserId,
    editingUserData,
    onInputChange,
    onDelete,
    onEdit,
    onSave,
    onCancel,
    onApprove,
    availableDepartments,
  }: TableRowProps) => {
    const isEditing = editingUserId === user._id;
    const [open, setOpen] = useState(false);
    const { refs, floatingStyles } = useFloating({
      strategy: "fixed",
      placement: "bottom-end" as Placement,
      middleware: [offset(4), flip(), shift({ padding: 8 })],
    });

    useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        const refEl = refs.reference.current as HTMLElement | null;
        const floEl = refs.floating.current as HTMLElement | null;
        if (
          refEl &&
          !refEl.contains(e.target as Node) &&
          floEl &&
          !floEl.contains(e.target as Node)
        ) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => {
        document.removeEventListener("mousedown", handler);
      };
    }, [open, refs]);

    return (
      <tr className="hover:bg-gray-50">
        <td className="px-3 py-2">
          {isEditing ? (
            <input
              name="username"
              aria-label="ชื่อผู้ใช้"
              placeholder="Username"
              value={editingUserData.username ?? ""}
              onChange={onInputChange}
              className="border px-2 py-1 rounded w-full text-xs md:text-sm"
            />
          ) : (
            user.username
          )}
        </td>
        <td className="px-3 py-2 hidden sm:table-cell">
          {isEditing ? (
            <input
              type="email"
              name="email"
              aria-label="อีเมล"
              placeholder="Email"
              value={editingUserData.email ?? ""}
              onChange={onInputChange}
              className="border px-2 py-1 rounded w-full text-xs md:text-sm"
            />
          ) : (
            user.email
          )}
        </td>
        <td className="px-3 py-2">
          {isEditing ? (
            <select
              name="role"
              aria-label="บทบาท"
              title="บทบาท"
              value={editingUserData.role ?? "User"}
              onChange={onInputChange}
              className="border px-2 py-1 rounded w-full text-xs md:text-sm"
            >
              <option value="User">User</option>
              <option value="Admin">Admin</option>
            </select>
          ) : (
            user.role
          )}
        </td>
        <td className="px-3 py-2 hidden lg:table-cell">
          {isEditing ? (
            <select
              name="department"
              aria-label="แผนก/กอง"
              title="แผนก/กอง"
              value={editingUserData.department ?? ""}
              onChange={onInputChange}
              className="border px-2 py-1 rounded w-full text-xs md:text-sm"
            >
              <option value="">-</option>
              {availableDepartments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : (
            availableDepartments.find((d) => d._id === user.department)?.name ||
            "-"
          )}
        </td>
        <td className="px-3 py-2 text-center hidden md:table-cell">
          {isEditing ? (
            <input
              type="number"
              name="storageQuota"
              aria-label="โควต้า (GB)"
              placeholder="GB"
              value={editingUserData.storageQuota ?? 0}
              onChange={onInputChange}
              className="border px-2 py-1 rounded w-full text-center text-xs md:text-sm"
            />
          ) : (
            user.storageQuota
          )}
        </td>
        <td className="px-3 py-2 text-center hidden md:table-cell">
          {user.isApproved ? (
            <span className="text-green-500">อนุมัติแล้ว</span>
          ) : (
            <span className="text-blue-500">รออนุมัติ</span>
          )}
        </td>
        <td className="px-3 py-2 text-center">
          {isEditing ? (
            <div className="flex justify-center gap-2">
              <button
                onClick={onSave}
                className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
              >
                บันทึก
              </button>
              <button
                onClick={onCancel}
                className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                ref={refs.setReference}
                onClick={() => setOpen((o) => !o)}
                aria-label="เปิดเมนู"
                title="เมนู"
                className="bg-blue-500 text-white px-2.5 py-1 rounded hover:bg-blue-600"
              >
                ☰
              </button>
              {open && (
                <div
                  ref={refs.setFloating}
                  style={floatingStyles}
                  className="z-[2000] w-36 rounded-md shadow-md bg-white border border-gray-200"
                  role="menu"
                >
                  {!user.isApproved && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        onApprove(user._id);
                        setOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-xs"
                    >
                      อนุมัติ
                    </button>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => {
                      onEdit(user);
                      setOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-xs"
                  >
                    แก้ไข
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      onDelete(user._id);
                      setOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-xs"
                  >
                    ลบ
                  </button>
                </div>
              )}
            </div>
          )}
        </td>
      </tr>
    );
  }
);
TableRow.displayName = "TableRow";

/* -------------------------------------------------------------------------- */
/*                          Card Component (Mobile)                           */
/* -------------------------------------------------------------------------- */

interface CardProps {
  user: User;
  isEditing: boolean;
  editingUserData: Partial<User>;
  onInputChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onDelete: (id: string) => void;
  onEdit: (user: User) => void;
  onSave: () => void;
  onCancel: () => void;
  onApprove: (id: string) => void;
  availableDepartments: Department[];
}

const Card = ({
  user,
  isEditing,
  editingUserData,
  onInputChange,
  onDelete,
  onEdit,
  onSave,
  onCancel,
  onApprove,
  availableDepartments,
}: CardProps) => {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles } = useFloating({
    strategy: "fixed",
    placement: "bottom-end",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const refEl = refs.reference.current as HTMLElement | null;
      const floEl = refs.floating.current as HTMLElement | null;
      if (
        refEl &&
        !refEl.contains(e.target as Node) &&
        floEl &&
        !floEl.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, [open, refs]);

  return (
    <div className="md:hidden bg-white rounded shadow p-4 mb-3">
      <div className="flex items-start justify-between">
        <div className="font-semibold text-sm">
          {isEditing ? (
            <input
              name="username"
              aria-label="ชื่อผู้ใช้"
              placeholder="Username"
              value={editingUserData.username ?? ""}
              onChange={onInputChange}
              className="border px-2 py-1 rounded w-40 text-xs"
            />
          ) : (
            user.username
          )}
        </div>
        <div className="relative">
          {isEditing ? (
            <div className="flex gap-1">
              <button
                onClick={onSave}
                aria-label="บันทึก"
                title="บันทึก"
                className="px-2 py-1 bg-green-500 text-white rounded text-xs"
              >
                ✔︎
              </button>
              <button
                onClick={onCancel}
                aria-label="ยกเลิก"
                title="ยกเลิก"
                className="px-2 py-1 bg-gray-500 text-white rounded text-xs"
              >
                ✖︎
              </button>
            </div>
          ) : (
            <>
              <button
                ref={refs.setReference}
                onClick={() => setOpen((o) => !o)}
                aria-label="เปิดเมนู"
                title="เมนู"
                className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 text-xs"
              >
                ☰
              </button>
              {open && (
                <div
                  ref={refs.setFloating}
                  style={floatingStyles}
                  className="z-[2000] w-24 rounded-md shadow-md bg-white border border-gray-200 text-xs"
                  role="menu"
                >
                  <button
                    role="menuitem"
                    onClick={() => {
                      onEdit(user);
                      setOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 hover:bg-gray-100"
                  >
                    แก้ไข
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      onDelete(user._id);
                      setOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 hover:bg-gray-100"
                  >
                    ลบ
                  </button>
                  {!user.isApproved && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        onApprove(user._id);
                        setOpen(false);
                      }}
                      className="block w-full text-left px-3 py-2 hover:bg-gray-100"
                    >
                      อนุมัติ
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="text-xs mt-1">
        {isEditing ? (
          <input
            type="email"
            name="email"
            aria-label="อีเมล"
            placeholder="Email"
            value={editingUserData.email ?? ""}
            onChange={onInputChange}
            className="border px-2 py-1 rounded w-full text-xs"
          />
        ) : (
          user.email
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-[0.7rem]">
        <div>
          <p className="text-gray-400">Role</p>
          {isEditing ? (
            <select
              name="role"
              aria-label="บทบาท"
              title="บทบาท"
              value={editingUserData.role ?? "User"}
              onChange={onInputChange}
              className="border px-1 py-1 rounded w-full text-[0.7rem]"
            >
              <option value="User">User</option>
              <option value="Admin">Admin</option>
            </select>
          ) : (
            <p>{user.role}</p>
          )}
        </div>
        <div>
          <p className="text-gray-400">Dept.</p>
          {isEditing ? (
            <select
              name="department"
              aria-label="แผนก/กอง"
              title="แผนก/กอง"
              value={editingUserData.department ?? ""}
              onChange={onInputChange}
              className="border px-1 py-1 rounded w-full text-[0.7rem]"
            >
              <option value="">-</option>
              {availableDepartments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : (
            <p>
              {
                availableDepartments.find((d) => d._id === user.department)
                  ?.name || "-"
              }
            </p>
          )}
        </div>
        <div>
          <p className="text-gray-400">Quota(GB)</p>
          {isEditing ? (
            <input
              type="number"
              name="storageQuota"
              aria-label="โควต้า (GB)"
              placeholder="GB"
              value={editingUserData.storageQuota ?? 0}
              onChange={onInputChange}
              className="border px-1 py-1 rounded w-full text-[0.7rem]"
            />
          ) : (
            <p>{user.storageQuota}</p>
          )}
        </div>
      </div>
      <div className="mt-2 text-xs">
        {user.isApproved ? (
          <span className="text-green-500">อนุมัติแล้ว</span>
        ) : (
          <span className="text-blue-500">รออนุมัติ</span>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                      UsersManagement (Main Component)                     */
/* -------------------------------------------------------------------------- */

export default function UsersManagement() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [users, setUsers] = useState<User[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<
    Department[]
  >([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserData, setEditingUserData] = useState<Partial<User>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [confirmTarget, setConfirmTarget] = useState<User | null>(null);

  const fetchUsers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", { signal });
      if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลผู้ใช้ได้");
      const { users } = await res.json();
      setUsers(users);
      setError(null);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch("/api/departments");
      if (!res.ok) throw new Error("ไม่สามารถดึงแผนก/กอง ได้");
      const { departments: deps } = await res.json();
      setAvailableDepartments(deps);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchUsers(ctrl.signal);
    fetchDepartments();
    return () => {
      ctrl.abort();
    };
  }, [fetchUsers, fetchDepartments]);

  const handleApprove = useCallback(async (id: string) => {
    if (!confirm("ยืนยันอนุมัติผู้ใช้นี้?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id, isApproved: true }),
      });
      if (!res.ok) throw new Error("อนุมัติไม่สำเร็จ");
      setUsers((prev) =>
        prev.map((u) => (u._id === id ? { ...u, isApproved: true } : u))
      );
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleEdit = useCallback((user: User) => {
    setEditingUserId(user._id);
    setEditingUserData(user);
  }, []);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setEditingUserData((prev) => ({
        ...prev,
        [name]: name === "storageQuota" ? Number(value) : value,
      }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!editingUserId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editingUserId, ...editingUserData }),
      });
      if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
      const updated = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u._id === editingUserId ? updated : u))
      );
      setEditingUserId(null);
      setEditingUserData({});
      window.dispatchEvent(new Event("storageOverviewRefresh"));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [editingUserId, editingUserData]);

  const handleCancel = useCallback(() => {
    setEditingUserId(null);
    setEditingUserData({});
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      const target = users.find((u) => u._id === id) || null;
      setConfirmTarget(target);
    },
    [users]
  );

  const executeDelete = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });
      if (!res.ok) throw new Error("ลบไม่สำเร็จ");
      setUsers((prev) => prev.filter((u) => u._id !== id));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return users
      .filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
      .sort((a, b) =>
        a.isApproved === b.isApproved ? 0 : a.isApproved ? 1 : -1
      );
  }, [users, searchTerm]);

  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const currentPage = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const itemsPerPage = 6;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const safePage =
    currentPage > totalPages && totalPages > 0 ? totalPages : currentPage;
  const paginated = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, safePage]);

  if (status === "loading") {
    return <p className="text-center py-4">กำลังโหลด…</p>;
  }
  if (!session || session.user.role !== "Admin") {
    return (
      <p className="text-center text-red-500 py-4">
        คุณไม่มีสิทธิ์เข้าถึงหน้านี้
      </p>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex flex-wrap sm:flex-nowrap justify-between items-stretch gap-2 mb-6">
        <button
          onClick={() => {
            const bom = "\uFEFF";
            const header =
              "Username,Email,Role,Department,Quota(GB),Status";
            const rows = filtered.map((u) => {
              const dept =
                availableDepartments.find((d) => d._id === u.department)
                  ?.name || "-";
              const statusTxt = u.isApproved
                ? "อนุมัติแล้ว"
                : "รออนุมัติ";
              return `${u.username},${u.email},${u.role},${dept},${u.storageQuota},${statusTxt}`;
            });
            saveAs(
              new Blob([bom + [header, ...rows].join("\r\n")], {
                type: "text/csv;charset=utf-8;",
              }),
              "users.csv"
            );
          }}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm whitespace-nowrap w-auto"
          disabled={loading}
        >
          Export CSV
        </button>
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ค้นหา Username หรือ Email"
          aria-label="ค้นหา Username หรือ Email"
          className="border px-3 py-2 rounded flex-1 min-w-0 text-sm"
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-red-500 text-center mb-4">{error}</p>
      )}

      <div className="hidden md:block">
        <div className="overflow-x-auto bg-white shadow rounded-md">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-100 whitespace-nowrap">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">
                  Username
                </th>
                <th className="px-3 py-3 text-left font-semibold hidden sm:table-cell">
                  Email
                </th>
                <th className="px-3 py-3 text-left font-semibold">
                  Role
                </th>
                <th className="px-3 py-3 text-left font-semibold hidden lg:table-cell">
                  Department
                </th>
                <th className="px-3 py-3 text-center font-semibold hidden md:table-cell">
                  Quota(GB)
                </th>
                <th className="px-3 py-3 text-center font-semibold hidden md:table-cell">
                  Status
                </th>
                <th className="px-3 py-3 text-center font-semibold">
                  Action
                </th>
              </tr>  
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-4 text-center text-gray-500"
                  >
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                paginated.map((u) => (
                  <TableRow
                    key={u._id}
                    user={u}
                    editingUserId={editingUserId}
                    editingUserData={editingUserData}
                    onInputChange={handleInputChange}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    onApprove={handleApprove}
                    availableDepartments={availableDepartments}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden">
        {paginated.length === 0 ? (
          <p className="text-center text-gray-500">ไม่พบข้อมูล</p>
        ) : (
          paginated.map((u) => (
            <Card
              key={u._id}
              user={u}
              isEditing={editingUserId === u._id}
              editingUserData={editingUserData}
              onInputChange={handleInputChange}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onSave={handleSave}
              onCancel={handleCancel}
              onApprove={handleApprove}
              availableDepartments={availableDepartments}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          searchParams={searchParams}
          pathname={pathname}
        />
      )}

      {loading && (
        <p className="text-center text-gray-600 mt-4">กำลังโหลด…</p>
      )}

      {confirmTarget && (
        <ConfirmDeleteModal
          open={!!confirmTarget}
          username={confirmTarget.username}
          onClose={() => setConfirmTarget(null)}
          onConfirm={() => executeDelete(confirmTarget._id)}
        />
      )}
    </div>
  );
}
