"use client";

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatBRL } from "@/lib/utils";

const COLORS: Record<string, string> = {
  HAIRCUT:   "#C9A84C",
  BEARD:     "#6366f1",
  COMBO:     "#10b981",
  TREATMENT: "#f59e0b",
  OTHER:     "#6b7280",
};
const LABELS: Record<string, string> = {
  HAIRCUT: "Corte", BEARD: "Barba", COMBO: "Combo", TREATMENT: "Tratamento", OTHER: "Outro",
};

interface Props {
  data:         { category: string; revenue: number; count: number }[];
  totalRevenue: number;
}

export default function ServiceMixDonut({ data }: Props) {
  const chartData = data.map((d) => ({
    name:  LABELS[d.category] ?? d.category,
    value: d.revenue,
    color: COLORS[d.category] ?? "#6b7280",
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          innerRadius={45}
          outerRadius={70}
          strokeWidth={0}
          paddingAngle={2}
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [formatBRL(Number(v ?? 0)), ""]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value) => <span style={{ color: "#9ca3af" }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
