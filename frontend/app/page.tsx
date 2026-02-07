"use client";

import { motion } from "framer-motion";
import AgentActivityPanel from "@/components/AgentActivityPanel";
import ClimatePanel from "@/components/ClimatePanel";
import ControlSurface from "@/components/ControlSurface";
import FarmAgentCards from "@/components/FarmAgentCards";
import FlowMap from "@/components/FlowMap";
import Header from "@/components/Header";
import LiveReservoirHero from "@/components/LiveReservoirHero";
import MissionPanel from "@/components/MissionPanel";
import ReservoirVisualization from "@/components/ReservoirVisualization";
import SystemMetrics from "@/components/SystemMetrics";
import { useBackendData } from "@/lib/useBackendData";

export default function HomePage() {
  const { data, setScenario, status, error, selectedDayIndex, setSelectedDayIndex } = useBackendData();

  const selectedSignal =
    data.dailySignals[Math.min(Math.max(selectedDayIndex, 0), Math.max(data.dailySignals.length - 1, 0))] ??
    data.dailySignals[data.dailySignals.length - 1];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
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

      <motion.section
        className="section-reveal"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
      >
        <LiveReservoirHero snapshot={data.liveReservoir} liveStatus={data.liveStatus} />
      </motion.section>

      <motion.section
        id="reservoir-detail"
        className="grid gap-6 lg:grid-cols-[1.4fr_1fr] section-reveal"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.06 }}
      >
        <ReservoirVisualization
          reservoir={data.reservoir}
          day={data.day}
          timeline={data.reservoirTimeline}
          selectedIndex={selectedDayIndex}
          onSelectIndex={setSelectedDayIndex}
        />
        <SystemMetrics metrics={data.metrics} />
      </motion.section>

      <motion.section
        className="grid gap-6 lg:grid-cols-[1.1fr_1fr] section-reveal"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.12 }}
      >
        <FarmAgentCards farms={data.farms} />
        <ClimatePanel climate={data.climate} />
      </motion.section>

      <motion.section
        className="grid gap-6 lg:grid-cols-[1.2fr_1fr] section-reveal"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.18 }}
      >
        <FlowMap flow={data.flow} />
        <ControlSurface liveStatus={data.liveStatus} />
      </motion.section>

      {selectedSignal ? (
        <motion.section
          className="grid gap-6 lg:grid-cols-[1fr_1fr] section-reveal"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.24 }}
        >
          <AgentActivityPanel signal={selectedSignal} farms={data.farms} />
          <MissionPanel
            purpose={data.objective.purpose}
            beneficiaries={data.objective.beneficiaries}
            scalePath={data.objective.scalePath}
          />
        </motion.section>
      ) : null}
    </main>
  );
}
