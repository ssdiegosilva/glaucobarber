"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { formatBRL } from "@/lib/utils";

interface Props {
  data:          { day: number; revenue: number }[];
  scheduledData: { day: number; count: number }[];
  dailyGoal:     number | null;
  currentDay?:   number;
}

export default function DailyRevenueChart({ data, dailyGoal, currentDay }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#C9A84C" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#C9A84C" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          interval={4}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
        />
        <Tooltip
          contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
          labelFormatter={(d) => `Dia ${d}`}
          formatter={(v: number) => [formatBRL(v), "Receita"]}
        />
        {dailyGoal != null && dailyGoal > 0 && (
          <ReferenceLine
            y={dailyGoal}
            stroke="#C9A84C"
            strokeDasharray="4 4"
            strokeOpacity={0.55}
            label={{ value: "Meta/dia", position: "insideTopRight", fontSize: 9, fill: "#C9A84C" }}
          />
        )}
        {currentDay != null && (
          <ReferenceLine x={currentDay} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
        )}
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#C9A84C"
          strokeWidth={2}
          fill="url(#revenueGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#C9A84C", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
