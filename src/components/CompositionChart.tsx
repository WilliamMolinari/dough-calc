import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DoughMath } from "../lib/calc";
import { fmtWeight } from "../lib/format";
import type { Unit } from "../lib/types";

const COLORS = {
  flour: "#f3e3c8",
  flour2: "#e0b98b",
  water: "#79c9ff",
  extras: "#c6f45f",
  yeast: "#ffb066",
};

export function CompositionChart({
  math,
  unit,
  secondaryLabel,
}: {
  math: DoughMath;
  unit: Unit;
  /** Name of the second flour, when a blend is active. */
  secondaryLabel?: string;
}) {
  const secondary = Math.min(Math.max(0, math.flourSecondary ?? 0), math.flour);
  const data = [
    { name: secondary > 0.5 ? "Base flour" : "Flour", value: math.flour - secondary, color: COLORS.flour },
    ...(secondary > 0.5
      ? [{ name: secondaryLabel ?? "Second flour", value: secondary, color: COLORS.flour2 }]
      : []),
    { name: "Water", value: math.water, color: COLORS.water },
    { name: "Salt & extras", value: math.salt + math.sweetener + math.oil, color: COLORS.extras },
    ...(math.yeast > 0.0001
      ? [{ name: "Yeast", value: math.yeast, color: COLORS.yeast }]
      : []),
  ];
  const total = data.reduce((sum, entry) => sum + entry.value, 0) || 1;

  return (
    <div>
      <div className="relative h-[164px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={54}
              outerRadius={74}
              paddingAngle={3}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive
              animationDuration={600}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              contentStyle={{
                background: "rgba(12,12,17,0.94)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
                padding: "6px 10px",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 11,
                color: "#f4efe6",
                boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
              }}
              itemStyle={{ color: "#f4efe6" }}
              formatter={(value) => fmtWeight(Number(value), unit)}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cream/30">Batch</span>
          <span className="mt-0.5 font-display text-[18px] font-semibold text-cream">
            {fmtWeight(math.totalDough, unit)}
          </span>
        </div>
      </div>

      <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: entry.color }}
                aria-hidden
              />
              <span className="truncate text-[11px] text-cream/50">{entry.name}</span>
            </span>
            <span className="font-mono text-[10px] text-cream/35">
              {entry.value > 0 && entry.value / total < 0.005
                ? "<1%"
                : `${Math.round((entry.value / total) * 100)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
