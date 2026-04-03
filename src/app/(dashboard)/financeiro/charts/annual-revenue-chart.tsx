"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";
import { formatBRL } from "@/lib/utils";

interface MonthEntry {
  month:     number;
  label:     string;
  revenue:   number;
  avgTicket: number;
  goal:      number | null;
}

interface Props {
  months:       MonthEntry[];
  currentMonth: number;
  currentYear:  number;
  year:         number;
}

export default function AnnualRevenueChart({ months, currentMonth, currentYear, year }: Props) {
  const isCurrent = year === currentYear;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={months} margin={{ top: 5, right: 20, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="rev"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
        />
        <YAxis
          yAxisId="ticket"
          orientation="right"
          tick={{ fontSize: 10, fill: "#6366f1" }}
          tickLine={false}
          axisLine={false}
          width={42}
          tickFormatter={(v) => `R$${v}`}
        />
        <Tooltip
          contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
          formatter={(value: number, name: string) => [
            name === "avgTicket" ? formatBRL(value) : formatBRL(value),
            name === "avgTicket" ? "Ticket médio" : "Receita",
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(v) => (
            <span style={{ color: "#9ca3af" }}>
              {v === "revenue" ? "Receita" : "Ticket médio"}
            </span>
          )}
        />
        <Bar yAxisId="rev" dataKey="revenue" name="revenue" radius={[3, 3, 0, 0]} maxBarSize={40}>
          {months.map((m, i) => {
            const isFuture = isCurrent && m.month > currentMonth;
            const hitGoal  = m.goal != null && m.revenue >= m.goal;
            const color    = isFuture ? "#374151" : hitGoal ? "#10b981" : m.revenue > 0 ? "#C9A84C" : "#374151";
            return <Cell key={i} fill={color} fillOpacity={isFuture ? 0.4 : 0.85} />;
          })}
        </Bar>
        <Line
          yAxisId="ticket"
          type="monotone"
          dataKey="avgTicket"
          name="avgTicket"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
