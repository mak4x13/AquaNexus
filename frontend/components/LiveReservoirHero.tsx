import type { LiveFeedStatus, LiveReservoirSnapshot } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import GlassPanel from "./GlassPanel";

type LiveReservoirHeroProps = {
  snapshot?: LiveReservoirSnapshot;
  liveStatus: LiveFeedStatus;
};

const statusTone: Record<LiveFeedStatus["mode"], string> = {
  live: "border-emerald-300/40 bg-emerald-400/20 text-emerald-100",
  "stale-cache": "border-amber-300/40 bg-amber-400/20 text-amber-100",
  "preset-fallback": "border-rose-300/40 bg-rose-400/20 text-rose-100"
};

const formatUtcTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export default function LiveReservoirHero({ snapshot, liveStatus }: LiveReservoirHeroProps) {
  const stations = snapshot?.stations ?? [];
  const totalInflow = stations.reduce((sum, station) => sum + station.inflow_cusecs, 0);
  const totalOutflow = stations.reduce((sum, station) => sum + station.outflow_cusecs, 0);
  const totalStorage = stations.reduce((sum, station) => sum + (station.estimated_storage_maf ?? 0), 0);

  return (
    <GlassPanel title="Live Reservoir Snapshot" subtitle="Pakistan dams: Tarbela, Mangla, Chashma">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone[liveStatus.mode]}`}>
              {liveStatus.label}
            </span>
            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-100">
              {snapshot?.source ?? "preset"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              FFD updated: {snapshot?.updated_at_pkt ?? "not available"}
            </span>
          </div>
          <a
            href="#reservoir-detail"
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 hover:bg-white/10"
          >
            View projected timeline
          </a>
        </div>

        {stations.length > 0 ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Total inflow</p>
                <p className="mt-2 text-3xl font-semibold text-cyan-100">{formatNumber(totalInflow, 0)}</p>
                <p className="mt-1 text-xs text-slate-400">cusecs</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Total outflow</p>
                <p className="mt-2 text-3xl font-semibold text-sky-100">{formatNumber(totalOutflow, 0)}</p>
                <p className="mt-1 text-xs text-slate-400">cusecs</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Estimated storage</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-100">{formatNumber(totalStorage, 2)}</p>
                <p className="mt-1 text-xs text-slate-400">MAF</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {stations.map((station) => (
                <article key={station.dam} className="rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-500/10 to-slate-950/30 p-4">
                  <p className="text-sm font-semibold text-slate-100">{station.dam}</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-200">
                    <p>
                      Inflow: <span className="font-semibold text-cyan-100">{formatNumber(station.inflow_cusecs, 0)}</span> cusecs
                    </p>
                    <p>
                      Outflow: <span className="font-semibold text-sky-100">{formatNumber(station.outflow_cusecs, 0)}</span> cusecs
                    </p>
                    <p>
                      Level: <span className="font-semibold">{station.current_level_ft !== null && station.current_level_ft !== undefined ? `${formatNumber(station.current_level_ft, 1)} ft` : "n/a"}</span>
                    </p>
                    <p>
                      Est. storage: <span className="font-semibold">{station.estimated_storage_maf !== null && station.estimated_storage_maf !== undefined ? `${formatNumber(station.estimated_storage_maf, 2)} MAF` : "n/a"}</span>
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-4 text-sm text-rose-100">
            Live station values are unavailable right now. Simulation continues with Pakistan preset assumptions.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <p>{liveStatus.detail}</p>
          <p>Fetched at: {snapshot ? formatUtcTimestamp(snapshot.fetched_at_utc) : "n/a"}</p>
        </div>
      </div>
    </GlassPanel>
  );
}
