"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatBRL } from "@/lib/utils";

interface MonthEntry {
  month:   number;
  label:   string;
  revenue: number;
}

interface Props {
  currentYear:  number;
  currentData:  MonthEntry[];
  prevYear:     number;
  prevData:     MonthEntry[];
}

export default function AnnualYoYChart({ currentYear, currentData, prevYear, prevData }: Props) {
  const combined = currentData.map((m, i) => ({
    label:   m.label,
    current: m.revenue,
    prev:    prevData[i]?.revenue ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={combined} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="curGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#C9A84C" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#C9A84C" stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6b7280" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#6b7280" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
        />
        <Tooltip
          contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
          formatter={(v, name) => [
            formatBRL(Number(v ?? 0)),
            name === "current" ? String(currentYear) : String(prevYear),
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(v) => (
            <span style={{ color: "#9ca3af" }}>
              {v === "current" ? currentYear : prevYear}
            </span>
          )}
        />
        <Area
          type="monotone"
          dataKey="prev"
          stroke="#6b7280"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          fill="url(#prevGrad)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="current"
          stroke="#C9A84C"
          strokeWidth={2}
          fill="url(#curGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#C9A84C", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
