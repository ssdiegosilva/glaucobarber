"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { formatBRL } from "@/lib/utils";

interface Props {
  data: { day: string; total: number }[];
}

export default function DiscountDailyChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={5}>
        <XAxis
          dataKey="day"
          tick={{ fontSize: 9, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => v.split("/")[0]}
          interval={3}
        />
        <YAxis hide />
        <Tooltip
          contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [formatBRL(Number(v ?? 0)), "Desconto"]}
        />
        <Bar dataKey="total" fill="#ef4444" fillOpacity={0.65} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
