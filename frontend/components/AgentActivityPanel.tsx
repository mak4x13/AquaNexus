import { motion, useReducedMotion } from "framer-motion";
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
    return "Policy agent flags inequality and shifts releases to underserved provinces.";
  }
  return "Policy agent keeps distribution inside fairness guardrails.";
};

const describeReservoir = (signal: DaySignal) => {
  if (signal.depletion_risk > 0.6) {
    return "Reservoir agent triggers strict rationing to protect storage thresholds.";
  }
  return "Reservoir agent allows planned releases while preserving safety buffer.";
};

const describeClimate = (signal: DaySignal) => {
  if (signal.drought) {
    return "Climate agent detects drought conditions and raises scarcity alert.";
  }
  return `Climate agent reports rainfall ${signal.rainfall.toFixed(1)} mm and moderate drought pressure.`;
};

export default function AgentActivityPanel({ signal, farms }: AgentActivityPanelProps) {
  const prefersReducedMotion = useReducedMotion();

  const topNeedFarm = [...farms].sort((a, b) => b.requested - a.requested)[0];
  const topNeedText = topNeedFarm
    ? `${topNeedFarm.name} has the highest daily demand (${topNeedFarm.requested.toFixed(1)} ML).`
    : "No farm data available.";

  const steps = [
    {
      id: "climate",
      title: "Climate agent",
      tone: "border-sky-300/30 bg-sky-400/10 text-sky-100",
      detail: describeClimate(signal),
      metric: signal.drought ? "Scarcity alert" : "Weather normal"
    },
    {
      id: "reservoir",
      title: "Reservoir agent",
      tone: "border-amber-300/30 bg-amber-400/10 text-amber-100",
      detail: describeReservoir(signal),
      metric: `Depletion risk ${(signal.depletion_risk * 100).toFixed(0)}%`
    },
    {
      id: "policy",
      title: "Policy agent",
      tone: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
      detail: describePolicy(signal),
      metric: `Gini ${signal.gini.toFixed(2)}`
    },
    {
      id: "farms",
      title: "Farm agents",
      tone: "border-white/20 bg-white/5 text-slate-100",
      detail: topNeedText,
      metric: `Allocated ${signal.total_allocated.toFixed(1)} ML`
    }
  ];

  return (
    <GlassPanel title="Agent Activity" subtitle={`Day ${signal.day} decision sequence`}>
      <ol className="grid gap-3">
        {steps.map((step, index) => (
          <motion.li
            key={step.id}
            initial={prefersReducedMotion ? false : { opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.45, delay: index * 0.1 }}
            className={`relative overflow-hidden rounded-2xl border p-4 text-sm ${step.tone}`}
          >
            <span className="absolute inset-y-0 left-0 w-1 bg-white/40" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em]">{step.title}</p>
                <p className="mt-2 text-slate-100">{step.detail}</p>
              </div>
              <span className="rounded-full border border-white/25 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-100">
                {step.metric}
              </span>
            </div>
          </motion.li>
        ))}
      </ol>
    </GlassPanel>
  );
}
