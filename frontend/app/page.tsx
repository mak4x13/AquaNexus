"use client";

import AgentActivityPanel from "@/components/AgentActivityPanel";
import ClimatePanel from "@/components/ClimatePanel";
import ControlSurface from "@/components/ControlSurface";
import FarmAgentCards from "@/components/FarmAgentCards";
import FlowMap from "@/components/FlowMap";
import Header from "@/components/Header";
import LiveReservoirHero from "@/components/LiveReservoirHero";
import MissionPanel from "@/components/MissionPanel";
import ReservoirVisualization from "@/components/ReservoirVisualization";
import ScenarioComparisonDock from "@/components/ScenarioComparisonDock";
import SystemMetrics from "@/components/SystemMetrics";
import { useBackendData } from "@/lib/useBackendData";

export default function HomePage() {
  const {
    data,
    setScenario,
    policyControls,
    setPolicyControls,
    status,
    error,
    selectedDayIndex,
    setSelectedDayIndex
  } = useBackendData();

  const selectedSignal =
    data.dailySignals[Math.min(Math.max(selectedDayIndex, 0), Math.max(data.dailySignals.length - 1, 0))] ??
    data.dailySignals[data.dailySignals.length - 1];
  const agentPlaybackKey = selectedSignal
    ? `${selectedSignal.day}-${data.scenario}-${data.liveStatus.mode}`
    : `none-${data.scenario}-${data.liveStatus.mode}`;

  return (
    <main className="mx-auto w-full max-w-[1450px]">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex flex-col gap-6">
          <Header
            scenario={data.scenario}
            scenarios={data.scenarios}
            onScenarioChange={setScenario}
            liveStatus={data.liveStatus}
          />

          {status === "error" ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-3 text-sm text-rose-100">
              Backend connection failed. {error ?? ""}
            </div>
          ) : null}

          {status !== "error" && error ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-3 text-sm text-amber-100">
              {error}
            </div>
          ) : null}

          <section className="section-reveal">
            <LiveReservoirHero snapshot={data.liveReservoir} liveStatus={data.liveStatus} />
          </section>

          <section id="reservoir-detail" className="grid gap-6 section-reveal lg:grid-cols-[1.4fr_1fr]">
            <ReservoirVisualization
              reservoir={data.reservoir}
              day={data.day}
              timeline={data.reservoirTimeline}
              selectedIndex={selectedDayIndex}
              onSelectIndex={setSelectedDayIndex}
            />
            <SystemMetrics metrics={data.metrics} />
          </section>

          <section className="grid gap-6 section-reveal lg:grid-cols-[1.1fr_1fr]">
            <FarmAgentCards farms={data.farms} />
            <ClimatePanel climate={data.climate} />
          </section>

          <section className="grid gap-6 section-reveal lg:grid-cols-[1.2fr_1fr]">
            <FlowMap flow={data.flow} />
            <ControlSurface liveStatus={data.liveStatus} />
          </section>

          {selectedSignal ? (
            <section className="grid gap-6 section-reveal lg:grid-cols-[1fr_1fr]">
              <AgentActivityPanel signal={selectedSignal} farms={data.farms} playbackKey={agentPlaybackKey} />
              <MissionPanel
                purpose={data.objective.purpose}
                beneficiaries={data.objective.beneficiaries}
                scalePath={data.objective.scalePath}
              />
            </section>
          ) : null}
        </div>

        <aside className="section-reveal lg:sticky lg:top-4 lg:max-h-[calc(100vh-1rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <ScenarioComparisonDock
            scenarios={data.scenarios}
            activeScenario={data.scenario}
            onScenarioChange={setScenario}
            policyControls={policyControls}
            onApplyPolicyControls={setPolicyControls}
          />
        </aside>
      </div>
    </main>
  );
}
