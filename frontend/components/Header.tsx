import type { LiveFeedStatus } from "@/lib/types";
import ScenarioToggle from "./ScenarioToggle";

type HeaderProps = {
  scenario: string;
  scenarios: string[];
  onScenarioChange: (scenario: string) => void;
  liveStatus: LiveFeedStatus;
};

const statusClass: Record<LiveFeedStatus["mode"], string> = {
  live: "border-emerald-300/40 bg-emerald-400/20 text-emerald-100",
  "stale-cache": "border-amber-300/40 bg-amber-400/20 text-amber-100",
  "preset-fallback": "border-rose-300/40 bg-rose-400/20 text-rose-100"
};

export default function Header({ scenario, scenarios, onScenarioChange, liveStatus }: HeaderProps) {
  return (
    <header className="glass-panel flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">AquaNexus Pakistan Command View</p>
        <h1 className="mt-3 text-4xl font-semibold">Water Allocation Decision Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Use live Pakistan dam and weather signals to compare province-level allocation policies before release decisions.
        </p>
      </div>
      <div className="flex flex-col items-start gap-4 sm:items-end">
        <span
          className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${statusClass[liveStatus.mode]}`}
        >
          {liveStatus.label}
        </span>
        <p className="max-w-sm text-right text-xs text-slate-300">{liveStatus.detail}</p>
        <ScenarioToggle scenario={scenario} scenarios={scenarios} onChange={onScenarioChange} />
      </div>
    </header>
  );
}
