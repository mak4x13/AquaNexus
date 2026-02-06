type ScenarioToggleProps = {
  scenario: string;
  scenarios: string[];
  onChange: (scenario: string) => void;
};

export default function ScenarioToggle({ scenario, scenarios, onChange }: ScenarioToggleProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 p-2">
      {scenarios.map((item) => {
        const active = item === scenario;
        return (
          <button
            key={item}
            onClick={() => onChange(item)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              active
                ? "bg-white text-slate-900"
                : "text-slate-200 hover:bg-white/10"
            } text-center min-w-[7.5rem] md:min-w-[8.5rem]`}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
