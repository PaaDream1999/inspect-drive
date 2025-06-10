// inspect-drive/src/components/Manage/StorageOverviewClient.tsx

"use client";

import dynamic from "next/dynamic";

// โหลดคอมโพเนนต์กราฟแบบ client-side เท่านั้น
const StorageOverviewChart = dynamic(
  () => import("@/components/Manage/StorageOverviewChart"),
  { ssr: false }
);

export default function StorageOverviewClient() {
  return <StorageOverviewChart />;
}
