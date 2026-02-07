import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import GlassPanel from "./GlassPanel";
import type { ClimateState } from "@/lib/types";
import { formatPct } from "@/lib/utils";

type ClimatePanelProps = {
  climate: ClimateState;
};

export default function ClimatePanel({ climate }: ClimatePanelProps) {
  return (
    <GlassPanel title="Climate Intelligence" subtitle="Forecast signals">
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Rainfall probability</p>
            <p className="mt-2 text-2xl font-semibold">{formatPct(climate.rainfall_probability)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Drought risk</p>
            <p className="mt-2 text-2xl font-semibold">{formatPct(climate.drought_risk)}</p>
          </div>
        </div>
        {climate.provinceWeather && climate.provinceWeather.length > 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Pakistan live weather</p>
              <p className="text-[11px] text-slate-500">{climate.source ?? "simulation"}</p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {climate.provinceWeather.map((row) => (
                <div key={row.province} className="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-xs">
                  <p className="font-semibold text-slate-100">{row.province}</p>
                  <p className="text-slate-400">{row.city}</p>
                  <p className="mt-1 text-slate-200">
                    {row.temperature_c.toFixed(1)} C | {row.precipitation_mm.toFixed(1)} mm rain
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="h-48 rounded-2xl border border-white/10 bg-white/5 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={climate.forecast} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="rain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis
                domain={[0, 1]}
                tickFormatter={(value) => `${Math.round(value * 100)}%`}
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}
                formatter={(value: number) => `${Math.round(value * 100)}%`}
              />
              <Area
                type="monotone"
                dataKey="rainfall_probability"
                stroke="#38bdf8"
                fill="url(#rain)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </GlassPanel>
  );
}
