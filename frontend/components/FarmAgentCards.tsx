import type { Farm } from "@/lib/types";
import GlassPanel from "./GlassPanel";
import { formatNumber, formatPct } from "@/lib/utils";

type FarmAgentCardsProps = {
  farms: Farm[];
};

export default function FarmAgentCards({ farms }: FarmAgentCardsProps) {
  return (
    <GlassPanel title="Farm Agent Cards" subtitle="Fairness = allocated/requested water">
      <div className="grid gap-4">
        <p className="text-xs text-slate-400">
          Fairness % = allocated water / requested water. 100% means the farm received its full requested demand.
        </p>
        {farms.map((farm) => {
          const allocationRatio = farm.allocated / farm.requested;
          const fairnessClass =
            farm.fairness >= 0.85
              ? "bg-emerald-400/70"
              : farm.fairness >= 0.75
                ? "bg-amber-300/70"
                : "bg-rose-400/70";

          return (
            <div key={farm.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{farm.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-400">Allocation</p>
                </div>
                <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200">
                  Fairness {formatPct(farm.fairness)}
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div className={`h-2 rounded-full ${fairnessClass}`} style={{ width: `${allocationRatio * 100}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-slate-300">
                <div>
                  <p className="uppercase tracking-[0.3em] text-slate-400">Requested</p>
                  <p className="mt-1 text-sm font-semibold">{formatNumber(farm.requested)} ML</p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.3em] text-slate-400">Allocated</p>
                  <p className="mt-1 text-sm font-semibold">{formatNumber(farm.allocated)} ML</p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.3em] text-slate-400">Yield</p>
                  <p className="mt-1 text-sm font-semibold">{formatNumber(farm.yield)} t</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
