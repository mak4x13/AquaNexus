import type { Farm } from "@/lib/types";
import GlassPanel from "./GlassPanel";

type DaySignal = {
  day: number;
  rainfall: number;
  drought: boolean;
  total_allocated: number;
  depletion_risk: number;
  gini: number;
};

type AgentActivityPanelProps = {
  signal: DaySignal;
  farms: Farm[];
};

const describePolicy = (signal: DaySignal) => {
  if (signal.gini > 0.2) {
    return "Policy agent flags inequality and pushes redistribution toward underserved farms.";
  }
  return "Policy agent confirms distribution remains within acceptable fairness bounds.";
};

const describeReservoir = (signal: DaySignal) => {
  if (signal.depletion_risk > 0.6) {
    return "Reservoir agent activates strict rationing to avoid threshold breach.";
  }
  return "Reservoir agent allows planned releases while monitoring safety buffer.";
};

const describeClimate = (signal: DaySignal) => {
  if (signal.drought) {
    return "Climate agent detects drought conditions and raises scarcity alert.";
  }
  return `Climate agent reports rainfall ${signal.rainfall.toFixed(1)} mm and moderate risk.`;
};

export default function AgentActivityPanel({ signal, farms }: AgentActivityPanelProps) {
  const topNeedFarm = [...farms].sort((a, b) => b.requested - a.requested)[0];
  const topNeedText = topNeedFarm
    ? `${topNeedFarm.name} has the highest daily demand (${topNeedFarm.requested.toFixed(1)} ML).`
    : "No farm data available.";

  return (
    <GlassPanel title="Agent Activity" subtitle={`Day ${signal.day} decision trace`}>
      <div className="grid gap-4 text-sm text-slate-200">
        <div className="rounded-2xl border border-sky-300/30 bg-sky-400/10 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-200">Climate agent</p>
          <p className="mt-2">{describeClimate(signal)}</p>
        </div>
        <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-100">Reservoir agent</p>
          <p className="mt-2">{describeReservoir(signal)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-100">Policy agent</p>
          <p className="mt-2">{describePolicy(signal)}</p>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Farm agents</p>
          <p className="mt-2">{topNeedText}</p>
          <p className="mt-2 text-xs text-slate-400">
            Total allocated this day: {signal.total_allocated.toFixed(1)} ML
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}