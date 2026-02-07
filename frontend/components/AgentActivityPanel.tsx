import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { AgentKpi, AgentStepState, DaySignal, Farm } from "@/lib/types";
import { buildAgentKpis, buildAgentWorkflowSteps } from "@/lib/agentWorkflow";
import GlassPanel from "./GlassPanel";

type AgentActivityPanelProps = {
  signal: DaySignal;
  farms: Farm[];
  playbackKey: string;
  playbackMs?: number;
};

const STEP_HANDOFF_MS = 150;

const kpiToneClasses: Record<AgentKpi["tone"], string> = {
  neutral: "border-white/20 bg-white/5 text-slate-100",
  good: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  warn: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  critical: "border-rose-300/30 bg-rose-400/10 text-rose-100"
};

const stepToneClasses: Record<string, string> = {
  sky: "border-sky-300/30 bg-sky-400/10",
  amber: "border-amber-300/30 bg-amber-400/10",
  emerald: "border-emerald-300/30 bg-emerald-400/10",
  slate: "border-white/20 bg-white/5"
};

const resolveStepState = (activeStep: number, index: number, prefersReducedMotion: boolean): AgentStepState => {
  if (prefersReducedMotion) return "done";
  if (activeStep < 0) return "queued";
  if (activeStep === index) return "processing";
  if (activeStep > index) return "done";
  return "queued";
};

const stepStateLabel: Record<AgentStepState, string> = {
  queued: "Queued",
  processing: "Thinking",
  done: "Done"
};

export default function AgentActivityPanel({
  signal,
  farms,
  playbackKey,
  playbackMs = 700
}: AgentActivityPanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const kpis = useMemo(() => buildAgentKpis(signal), [signal]);
  const steps = useMemo(() => buildAgentWorkflowSteps(signal, farms), [signal, farms]);

  const [activeStep, setActiveStep] = useState<number>(prefersReducedMotion ? steps.length : -1);

  useEffect(() => {
    if (prefersReducedMotion) {
      setActiveStep(steps.length);
      return;
    }

    setActiveStep(-1);

    const cadence = Math.max(350, playbackMs) + STEP_HANDOFF_MS;
    const timers: number[] = [];

    for (let idx = 0; idx < steps.length; idx += 1) {
      timers.push(
        window.setTimeout(() => {
          setActiveStep(idx);
        }, idx * cadence)
      );
    }

    timers.push(
      window.setTimeout(() => {
        setActiveStep(steps.length);
      }, steps.length * cadence)
    );

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [playbackKey, playbackMs, prefersReducedMotion, steps.length]);

  return (
    <GlassPanel title="Agent Activity" subtitle={`How agents produced Day ${signal.day} outcome`}>
      <div className="grid gap-5">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <article
              key={kpi.id}
              className={`min-h-20 rounded-2xl border px-4 py-3 text-right ${kpiToneClasses[kpi.tone]}`}
            >
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-300">{kpi.label}</p>
              <p className="mt-2 text-base font-semibold text-slate-100">{kpi.value}</p>
            </article>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-sky-100">
            Evidence: rainfall {signal.rainfall.toFixed(1)} mm
          </span>
          <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-amber-100">
            Evidence: depletion {(signal.depletion_risk * 100).toFixed(0)}%
          </span>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-emerald-100">
            Evidence: gini {signal.gini.toFixed(2)}
          </span>
          <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-slate-100">
            Evidence: allocated {signal.total_allocated.toFixed(1)} ML
          </span>
        </div>

        <ol className="grid gap-2">
          {steps.map((step, index) => {
            const stepState = resolveStepState(activeStep, index, Boolean(prefersReducedMotion));
            const isProcessing = stepState === "processing";
            const isDone = stepState === "done";
            const toneClass = stepToneClasses[step.tone] ?? stepToneClasses.slate;

            return (
              <li key={step.id} className="grid gap-2">
                <motion.article
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: index * 0.04 }}
                  className={`rounded-2xl border p-4 text-sm transition ${toneClass} ${isProcessing ? "agent-step-processing" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-100">{step.title}</p>
                    <div className="flex items-center gap-2">
                      {isProcessing ? (
                        <span className="agent-thinking-dots" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                      ) : null}
                      <span className="rounded-full border border-white/30 bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-100">
                        {stepStateLabel[stepState]}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-1 text-xs text-slate-200">
                    <p>
                      <span className="text-slate-400">Input:</span> {step.input}
                    </p>
                    <p>
                      <span className="text-slate-400">Decision:</span> {step.decision}
                    </p>
                    <p className={`${isDone || isProcessing ? "opacity-100" : "opacity-70"} transition-opacity`}>
                      <span className="text-slate-400">Output:</span> {step.output}
                    </p>
                  </div>

                  <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-slate-300">Impact: {step.impactTag}</p>
                </motion.article>

                {index < steps.length - 1 ? (
                  <div className="flex justify-center">
                    <span
                      className={`agent-step-connector ${
                        activeStep > index || prefersReducedMotion ? "agent-step-connector-active" : ""
                      }`}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </GlassPanel>
  );
}
