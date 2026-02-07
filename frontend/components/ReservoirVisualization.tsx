import { formatNumber, formatPct } from "@/lib/utils";
import type { ReservoirState, ReservoirTimelinePoint } from "@/lib/types";
import GlassPanel from "./GlassPanel";

type ReservoirVisualizationProps = {
  reservoir: ReservoirState;
  day: number;
  timeline: ReservoirTimelinePoint[];
  selectedIndex: number;
  onSelectIndex: (index: number | null) => void;
};

export default function ReservoirVisualization({
  reservoir,
  day,
  timeline,
  selectedIndex,
  onSelectIndex
}: ReservoirVisualizationProps) {
  const clampedIndex = Math.min(Math.max(selectedIndex, 0), Math.max(timeline.length - 1, 0));
  const selected = timeline[clampedIndex];
  const displayDay = selected?.day ?? day;
  const displayLevel = selected?.reservoir_level ?? reservoir.reservoir_level;
  const displayInflow = selected?.inflow ?? reservoir.inflow;
  const displayOutflow = selected?.outflow ?? reservoir.outflow;
  const levelPct = Math.min(100, Math.max(0, displayLevel));
  const threshold = reservoir.sustainability_threshold;
  const latestIndex = Math.max(timeline.length - 1, 0);
  const isPinnedHistory = clampedIndex < latestIndex;

  return (
    <GlassPanel title="Reservoir Projection" subtitle={`Simulation day ${displayDay}`} className="relative overflow-hidden">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative h-56 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40 shadow-inner">
          <div className="absolute inset-4 rounded-[24px] border border-white/10 bg-gradient-to-br from-sky-500/20 via-slate-950/10 to-blue-600/30" />
          <div className="absolute inset-4 rounded-[24px] border border-white/10 bg-white/5" />
          <div className="absolute inset-x-6 bottom-6 top-6 rounded-[22px] border border-white/10 bg-white/5">
            <div
              className="absolute inset-x-0 bottom-0 rounded-[20px] bg-gradient-to-t from-sky-400 via-sky-500/70 to-cyan-300/40 shadow-inner"
              style={{ height: `${levelPct}%` }}
            />
            <div
              className="absolute left-0 right-0 border-t border-dashed border-aqua-ember"
              style={{ bottom: `${threshold}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Reservoir level</p>
            <p className="mt-2 text-3xl font-semibold">{formatNumber(displayLevel)}%</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Inflow</p>
              <p className="mt-1 text-xl font-semibold">{formatNumber(displayInflow)} ML</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Outflow</p>
              <p className="mt-1 text-xl font-semibold">{formatNumber(displayOutflow)} ML</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sustainability threshold</p>
            <p className="mt-2 text-lg font-semibold">{formatPct(threshold / 100)}</p>
          </div>

          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-500/10 p-4 text-xs text-slate-200">
            Live inputs feed this run. The chart and slider show projected allocation outcomes over the simulation timeline.
          </div>

          {timeline.length > 1 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
                <span>Day {timeline[0].day}</span>
                <span>Day {timeline[timeline.length - 1].day}</span>
              </div>
              <input
                type="range"
                min={0}
                max={latestIndex}
                value={clampedIndex}
                onChange={(event) => onSelectIndex(Number(event.target.value))}
                className="mt-3 w-full accent-sky-400"
              />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-400">{isPinnedHistory ? `Pinned to Day ${displayDay}` : "Live view"}</p>
                <button
                  type="button"
                  onClick={() => onSelectIndex(null)}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-200 hover:bg-white/10"
                >
                  Jump to latest
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </GlassPanel>
  );
}
