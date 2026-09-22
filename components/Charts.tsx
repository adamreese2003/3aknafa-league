"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const VOLT = "#c9f73b";
const ICE = "#58d5e8";
const EMBER = "#f05636";

const tooltipStyle = {
  backgroundColor: "#101b28",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: "0.75rem",
  fontFamily: "var(--font-body)",
  fontSize: "0.8rem",
  color: "#eef2f6",
} as const;

export function WinRateChart({
  data,
}: {
  data: { name: string; winPct: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit="%"
        />
        <YAxis
          type="category"
          dataKey="name"
          width={86}
          tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={tooltipStyle}
          formatter={(v) => [`${Number(v).toFixed(1)}%`, "Win rate"]}
        />
        <Bar dataKey="winPct" radius={[0, 6, 6, 0]} barSize={18}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={i === 0 ? VOLT : "rgba(255,255,255,0.22)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WinsLossesChart({
  data,
}: {
  data: { name: string; wins: number; losses: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ left: -14, right: 10, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="name"
          tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-32}
          textAnchor="end"
          height={58}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }} />
        <Bar dataKey="wins" name="Wins" fill={VOLT} radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Bar dataKey="losses" name="Losses" fill={EMBER} fillOpacity={0.75} radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyTrendChart({
  data,
}: {
  data: { month: string; winPct: number; matches: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ left: -14, right: 14, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="month"
          tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit="%"
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)}%`, "Win rate"]} />
        <Line
          type="monotone"
          dataKey="winPct"
          stroke={ICE}
          strokeWidth={2.5}
          dot={{ r: 4, fill: ICE, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: VOLT, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
