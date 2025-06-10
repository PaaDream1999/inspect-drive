// inspect-drive\src\components\Share\ShareOptionRadioGroup.tsx

"use client";

import React from "react";
import { Info } from "lucide-react";

type ShareOptionRadioGroupProps = {
  shareOption: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isSecret?: boolean; // prop สำหรับระบุว่าไฟล์เป็นลับหรือไม่
};

const ShareOptionRadioGroup: React.FC<ShareOptionRadioGroupProps> = ({
  shareOption,
  onChange,
  isSecret = false,
}) => {
  // ถ้าไฟล์เป็นลับ ให้แสดงเฉพาะตัวเลือก "secret"
  // ถ้าไม่เป็นลับ ให้แสดงเฉพาะ "private", "department" และ "public"
  const shareOptions = isSecret ? ["secret"] : ["private", "department", "public"];

  return (
    <div className="flex flex-col space-y-2">
      {shareOptions.map((option) => (
        <label key={option} className="inline-flex items-center space-x-2 ml-3">
          <input
            type="radio"
            name="shareOption"
            value={option}
            checked={shareOption === option}
            onChange={onChange}
            className="form-radio text-blue-500"
            disabled={isSecret} // ถ้าไฟล์เป็นลับ ไม่ให้เปลี่ยนตัวเลือก
          />
          <span className="text-gray-700 flex items-center">
            {option === "private" && "ส่วนตัว (เฉพาะฉัน)"}
            {option === "department" && "แชร์ให้แผนก/กอง"}
            {option === "public" && "แชร์ให้ทุกคน"}
            {option === "secret" && (
              <>
                แชร์แบบชั้นความลับ
                <div className="relative inline-block ml-1.5 group">
                  <Info className="w-5 h-5 text-blue-500 cursor-pointer" />
                  <div
                    className="
                      absolute hidden group-hover:block z-10 bg-gray-700 text-white text-sm rounded-md p-2 shadow-lg
                      w-fit max-w-xs whitespace-nowrap
                      bottom-full left-1/2 -translate-x-1/2 mb-2 md:bottom-auto md:left-full md:top-1/2 md:translate-x-0 md:-translate-y-1/2 md:ml-2 md:mb-0
                    "
                  >
                    ใช้ Secret Key เพื่อถอดรหัสไฟล์ลับ
                  </div>
                </div>
              </>
            )}
          </span>
        </label>
      ))}
    </div>
  );
};

export default React.memo(ShareOptionRadioGroup);
