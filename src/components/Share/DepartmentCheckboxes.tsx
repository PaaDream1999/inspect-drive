// inspect-drive/src/components/Share/DepartmentCheckboxes.tsx

"use client";

import React, { useState, useEffect } from "react";

type Department = {
  _id: string;
  name: string;
};

type DepartmentCheckboxesProps = {
  selectedDepartments: string[];
  toggleDepartmentSelection: (deptId: string) => void;
};

const DepartmentCheckboxes: React.FC<DepartmentCheckboxesProps> = ({
  selectedDepartments,
  toggleDepartmentSelection,
}) => {
  // สร้าง state สำหรับเก็บรายชื่อแผนก/กอง ที่ได้มาจาก API
  const [departments, setDepartments] = useState<Department[]>([]);

  // ดึงข้อมูลแผนก/กอง จาก API endpoint เมื่อ component mount
  useEffect(() => {
    async function fetchDepartments() {
      try {
        const res = await fetch("/api/departments");
        if (!res.ok) {
          throw new Error("ไม่สามารถดึงข้อมูลแผนก/กอง ได้");
        }
        const data = await res.json();
        // คาดว่า data.departments เป็น array ของ { _id, name }
        setDepartments(data.departments || []);
      } catch (error) {
        console.error("Error fetching departments:", error);
      }
    }
    fetchDepartments();
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
      {departments.map((dept) => (
        <label
          key={dept._id}
          className={`flex items-center border rounded-md px-3 py-1 cursor-pointer ${
            selectedDepartments.includes(dept._id)
              ? "bg-blue-100 border-blue-500"
              : "border-gray-300"
          }`}
        >
          <input
            type="checkbox"
            className="form-checkbox text-blue-500"
            checked={selectedDepartments.includes(dept._id)}
            onChange={() => toggleDepartmentSelection(dept._id)}
          />
          <span className="ml-2 text-gray-700">{dept.name}</span>
        </label>
      ))}
    </div>
  );
};

export default React.memo(DepartmentCheckboxes);
