import { useEffect, useState } from "react";
import type { PolicyControls } from "@/lib/types";
import GlassPanel from "./GlassPanel";

type ScenarioComparisonDockProps = {
  scenarios: string[];
  activeScenario: string;
  onScenarioChange: (scenario: string) => void;
  policyControls: PolicyControls;
  onApplyPolicyControls: (controls: PolicyControls) => void;
};

export default function ScenarioComparisonDock({
  scenarios,
  activeScenario,
  onScenarioChange,
  policyControls,
  onApplyPolicyControls
}: ScenarioComparisonDockProps) {
  const [draft, setDraft] = useState<PolicyControls>(policyControls);
  const [showPolicyInputs, setShowPolicyInputs] = useState(false);

  useEffect(() => {
    setDraft(policyControls);
  }, [policyControls]);

  const updateQuota = (province: keyof PolicyControls["provinceQuotas"], value: string) => {
    const numeric = Number(value);
    setDraft((prev) => ({
      ...prev,
      provinceQuotas: {
        ...prev.provinceQuotas,
        [province]: Number.isFinite(numeric) ? numeric : 0
      }
    }));
  };

  return (
    <GlassPanel title="Policy Selector" subtitle="Scenario + quota controls" className="p-4">
      <div className="grid gap-2.5 text-sm">
        <div className="grid grid-cols-2 gap-2">
          {scenarios.map((scenario) => {
            const active = scenario === activeScenario;
            return (
              <button
                key={scenario}
                type="button"
                onClick={() => onScenarioChange(scenario)}
                className={`w-full rounded-xl border px-2.5 py-2 text-left text-[11px] font-semibold tracking-[0.04em] transition ${
                  active
                    ? "border-cyan-300/45 bg-cyan-400/15 text-cyan-50"
                    : "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                }`}
              >
                {scenario}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowPolicyInputs((prev) => !prev)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200 hover:bg-white/10"
        >
          {showPolicyInputs ? "Hide policy inputs" : "Show policy inputs"}
        </button>

        {showPolicyInputs ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5">
            <div className="grid gap-2.5">
              <label className="grid gap-1 text-xs text-slate-300">
                <span>Sustainability threshold (%)</span>
                <input
                  type="number"
                  min={5}
                  max={90}
                  step={1}
                  value={draft.sustainabilityThresholdPct}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setDraft((prev) => ({
                      ...prev,
                      sustainabilityThresholdPct: Number.isFinite(value) ? value : prev.sustainabilityThresholdPct
                    }));
                  }}
                  className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-1.5 text-sm text-slate-100"
                />
              </label>

              <label className="grid gap-1 text-xs text-slate-300">
                <span>Quota mode</span>
                <select
                  value={draft.quotaMode}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      quotaMode: event.target.value as PolicyControls["quotaMode"]
                    }))
                  }
                  className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-1.5 text-sm text-slate-100"
                >
                  <option value="share">Share</option>
                  <option value="absolute">Absolute</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    "Punjab",
                    "Sindh",
                    "Khyber Pakhtunkhwa",
                    "Balochistan"
                  ] as Array<keyof PolicyControls["provinceQuotas"]>
                ).map((province) => (
                  <label key={province} className="grid gap-1 text-xs text-slate-300">
                    <span className="truncate" title={province}>{province}</span>
                    <input
                      type="number"
                      min={0}
                      step={draft.quotaMode === "share" ? 0.01 : 1}
                      value={draft.provinceQuotas[province]}
                      onChange={(event) => updateQuota(province, event.target.value)}
                      className="rounded-xl border border-white/10 bg-slate-950/40 px-2 py-1.5 text-sm text-slate-100"
                    />
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onApplyPolicyControls(draft)}
                className="rounded-xl border border-cyan-300/35 bg-cyan-400/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100 hover:bg-cyan-300/20"
              >
                Apply policy inputs
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Policy inputs are collapsed to keep this panel compact while scrolling.
          </p>
        )}
      </div>
    </GlassPanel>
  );
}
