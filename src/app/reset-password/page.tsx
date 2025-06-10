// inspect-drive\src\app\reset-password\page.tsx

import { Suspense } from "react";
import ResetPasswordClient from "@/components/ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordClient />
    </Suspense>
  );
}
