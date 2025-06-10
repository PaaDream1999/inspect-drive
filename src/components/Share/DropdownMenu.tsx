// inspect-drive/src/components/Share/DropdownMenu.tsx

import React from "react";

type DropdownMenuProps = {
  children: React.ReactNode;
};

const DropdownMenu = ({ children }: DropdownMenuProps) => {
  return (
    <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-md z-10">
      {children}
    </div>
  );
};

export default React.memo(DropdownMenu);
