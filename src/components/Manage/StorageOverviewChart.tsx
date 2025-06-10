// inspect-drive/src/components/Manage/StorageOverviewChart.tsx

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface OverviewData {
  allocated: number; // sum of users' quotas in GB
  freeDisk: number;  // actual free disk space in GB
  totalDisk: number; // total disk capacity in GB
}

interface ChartItem {
  name: string;
  value: number;
}

interface LabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  name: string;
  value: number;
  index: number;
}

const COLORS = ["#3B82F6", "#EF4444"];
const RADIAN = Math.PI / 180;

const StorageOverviewChart: React.FC = React.memo(() => {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  // detect mobile
  useEffect(() => {
    const updateMobile = () => setIsMobile(window.innerWidth < 768);
    updateMobile();
    window.addEventListener("resize", updateMobile);
    return () => window.removeEventListener("resize", updateMobile);
  }, []);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files/storage/overview", { cache: "no-store" });
      if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูล Storage Overview ได้");
      const data = (await res.json()) as OverviewData;
      setOverview(data);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    const handler = () => fetchOverview();
    window.addEventListener("storageOverviewRefresh", handler);
    return () => window.removeEventListener("storageOverviewRefresh", handler);
  }, [fetchOverview]);

  const chartData = useMemo<ChartItem[]>(() => {
    if (!overview) return [];
    return [
      { name: "Free Disk", value: overview.freeDisk },
      { name: "Total Quota", value: overview.allocated },
    ].map((item) => ({
      name: item.name,
      value: Number(item.value.toFixed(2)),
    }));
  }, [overview]);

  // custom label
  const renderCustomizedLabel = (props: LabelProps) => {
    const {
      cx,
      cy,
      midAngle,
      outerRadius,
      name,
      value,
      index,
    } = props;

    // กำหนด offset: บนมือถือ 30px, บนจอใหญ่ 30px
    const LABEL_OFFSET = isMobile ? 30 : 30;
    const radius = outerRadius + LABEL_OFFSET;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const anchor = x > cx ? "start" : "end";
    const fill = COLORS[index % COLORS.length];

    return (
      <text
        x={x}
        y={y}
        fill={fill}
        fontSize={isMobile ? 8 : 12}
        textAnchor={anchor}
        dominantBaseline="central"
      >
        {`${name}: ${value} GB`}
      </text>
    );
  };

  if (loading) {
    return (
      <p className="text-center text-gray-500 mb-4">
        กำลังโหลดกราฟ Storage Overview…
      </p>
    );
  }
  if (error || !overview) {
    return (
      <p className="text-center text-red-500">
        เกิดข้อผิดพลาด: {error || "ไม่พบข้อมูล"}
      </p>
    );
  }

  return (
    <div className="bg-white p-4 rounded-md shadow mb-4">
      <h2 className="text-lg font-semibold mb-4">Storage Overview</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            label={renderCustomizedLabel}
          >
            {chartData.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(val: number) => `${val} GB`} />
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{ marginBottom: '-6px' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-sm text-center">
        <strong>Free Disk:</strong> {overview.freeDisk} GB&nbsp;/&nbsp;
        <strong>Total Quota:</strong> {overview.allocated} GB
      </p>
    </div>
  );
});

StorageOverviewChart.displayName = "StorageOverviewChart";
export default StorageOverviewChart;
