import GlassPanel from "./GlassPanel";

type MissionPanelProps = {
  purpose: string;
  beneficiaries: string[];
  scalePath: string[];
};

export default function MissionPanel({ purpose, beneficiaries, scalePath }: MissionPanelProps) {
  return (
    <GlassPanel title="Why AquaNexus" subtitle="Pakistan water scarcity mission">
      <div className="grid gap-5 text-sm text-slate-200">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Purpose</p>
          <p className="mt-2 leading-relaxed">{purpose}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Positive impact</p>
            <ul className="mt-2 space-y-2 text-slate-200">
              {beneficiaries.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Scale path</p>
            <ul className="mt-2 space-y-2 text-slate-200">
              {scalePath.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}