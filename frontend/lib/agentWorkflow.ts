import type { AgentKpi, AgentWorkflowStep, DaySignal, Farm } from "./types";
import { clamp } from "./utils";

const topDemandFarm = (farms: Farm[]) => [...farms].sort((a, b) => b.requested - a.requested)[0];

const weatherValue = (signal: DaySignal) => {
  if (signal.drought) return "Scarcity alert";
  return signal.rainfall > 0 ? `Rain ${signal.rainfall.toFixed(1)} mm` : "Weather normal";
};

const weatherTone = (signal: DaySignal): AgentKpi["tone"] => {
  if (signal.drought) return "critical";
  if (signal.rainfall <= 0.5) return "warn";
  return "good";
};

const depletionTone = (risk: number): AgentKpi["tone"] => {
  if (risk >= 0.6) return "critical";
  if (risk >= 0.3) return "warn";
  return "good";
};

const giniTone = (gini: number): AgentKpi["tone"] => {
  if (gini >= 0.3) return "critical";
  if (gini >= 0.2) return "warn";
  return "good";
};

export const buildAgentKpis = (signal: DaySignal): AgentKpi[] => [
  {
    id: "weather",
    label: "Weather",
    value: weatherValue(signal),
    tone: weatherTone(signal)
  },
  {
    id: "depletion",
    label: "Depletion Risk",
    value: `${Math.round(clamp(signal.depletion_risk, 0, 1) * 100)}%`,
    tone: depletionTone(signal.depletion_risk)
  },
  {
    id: "gini",
    label: "Gini",
    value: signal.gini.toFixed(2),
    tone: giniTone(signal.gini)
  },
  {
    id: "allocated",
    label: "Allocated",
    value: `${signal.total_allocated.toFixed(1)} ML`,
    tone: "neutral"
  }
];

export const buildAgentWorkflowSteps = (signal: DaySignal, farms: Farm[]): AgentWorkflowStep[] => {
  const demandLead = topDemandFarm(farms);
  const leadDemand = demandLead
    ? `${demandLead.name} demand ${demandLead.requested.toFixed(1)} ML`
    : "No farm demand data";

  const scarcity = signal.drought || signal.rainfall < 1;
  const pressure = scarcity ? "high" : signal.depletion_risk > 0.3 ? "medium" : "normal";

  return [
    {
      id: "climate",
      title: "Climate agent",
      input: `Observed rainfall ${signal.rainfall.toFixed(1)} mm`,
      decision: scarcity
        ? "Classify day as scarcity pressure and raise alert to reservoir agent"
        : "Classify day as manageable pressure and pass normal advisory",
      output: `Hydro pressure ${pressure}`,
      impactTag: scarcity ? "scarcity-up" : "stable-weather",
      tone: "sky"
    },
    {
      id: "reservoir",
      title: "Reservoir agent",
      input: `Hydro pressure ${pressure}, depletion risk ${(signal.depletion_risk * 100).toFixed(0)}%`,
      decision:
        signal.depletion_risk > 0.6
          ? "Apply strict release cap to protect threshold"
          : "Release planned supply while preserving buffer",
      output: `Release target ${signal.total_allocated.toFixed(1)} ML`,
      impactTag: signal.depletion_risk > 0.6 ? "rationing" : "controlled-release",
      tone: "amber"
    },
    {
      id: "policy",
      title: "Policy agent",
      input: `Release target ${signal.total_allocated.toFixed(1)} ML, gini ${signal.gini.toFixed(2)}`,
      decision:
        signal.gini > 0.2
          ? "Reweight shares toward underserved provinces"
          : "Keep current allocation weighting",
      output: signal.gini > 0.2 ? "Fairness correction applied" : "Fairness within guardrail",
      impactTag: signal.gini > 0.2 ? "equity-adjustment" : "equity-stable",
      tone: "emerald"
    },
    {
      id: "farms",
      title: "Farm agents",
      input: `Policy release distributed across province farms`,
      decision: demandLead
        ? `Prioritize supply against peak demand (${leadDemand})`
        : "Execute available allocation plan",
      output: `Delivered ${signal.total_allocated.toFixed(1)} ML total`,
      impactTag: "yield-response",
      tone: "slate"
    }
  ];
};
