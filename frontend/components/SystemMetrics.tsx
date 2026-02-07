import {
  LineChart,
  Line,
  Label,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import GlassPanel from "./GlassPanel";
import type { MetricsState } from "@/lib/types";
import { formatPct } from "@/lib/utils";

type SystemMetricsProps = {
  metrics: MetricsState;
};

export default function SystemMetrics({ metrics }: SystemMetricsProps) {
  const yieldData = metrics.total_yield.map((value, index) => ({
    day: `D${index + 1}`,
    value
  }));

  return (
    <GlassPanel title="System Metrics" subtitle="Operational KPIs">
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sustainability</p>
            <p className="mt-2 text-2xl font-semibold">{formatPct(metrics.sustainability_score)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Gini index</p>
            <p className="mt-2 text-2xl font-semibold">{metrics.gini_index.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Depletion risk</p>
            <p className="mt-2 text-2xl font-semibold">{formatPct(metrics.depletion_risk)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Total yield</p>
            <p className="mt-2 text-2xl font-semibold">
              {metrics.total_yield[metrics.total_yield.length - 1].toFixed(1)} kt
            </p>
          </div>
        </div>
        <div className="h-56 rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="mb-2 text-xs uppercase tracking-[0.28em] text-slate-400">Yield Trend (kt)</p>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yieldData} margin={{ top: 8, right: 12, left: -4, bottom: 20 }}>
              <XAxis
                dataKey="day"
                stroke="#94a3b8"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                label={{ value: "Day", position: "insideBottom", dy: 12, fill: "#94a3b8", fontSize: 10 }}
              />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={48}>
                <Label value="Yield (kt)" angle={-90} position="insideLeft" offset={8} fill="#94a3b8" fontSize={10} />
              </YAxis>
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}
              />
              <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </GlassPanel>
  );
}
