import ScenarioToggle from "./ScenarioToggle";

type HeaderProps = {
  scenario: string;
  scenarios: string[];
  onScenarioChange: (scenario: string) => void;
  dataMode: "default" | "pakistan";
  onDataModeChange: (mode: "default" | "pakistan") => void;
};

const dataOptions: Array<{ id: "default" | "pakistan"; label: string }> = [
  { id: "default", label: "Default" },
  { id: "pakistan", label: "Pakistan" }
];

export default function Header({
  scenario,
  scenarios,
  onScenarioChange,
  dataMode,
  onDataModeChange
}: HeaderProps) {
  return (
    <header className="glass-panel flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">AquaNexus control nexus</p>
        <h1 className="mt-3 text-4xl font-semibold">Futuristic Water Allocation Command</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Adaptive intelligence orchestrating reservoir health, farm equity, and climate resilience.
        </p>
      </div>
      <div className="flex flex-col items-start gap-4 sm:items-end">
        <div className="rounded-full border border-white/10 bg-white/5 p-1">
          <div className="flex items-center gap-1">
            {dataOptions.map((option) => {
              const active = option.id === dataMode;
              return (
                <button
                  key={option.id}
                  onClick={() => onDataModeChange(option.id)}
                  className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                    active
                      ? "bg-white text-slate-900"
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <ScenarioToggle scenario={scenario} scenarios={scenarios} onChange={onScenarioChange} />
      </div>
    </header>
  );
}
