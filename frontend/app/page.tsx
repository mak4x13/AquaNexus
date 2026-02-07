"use client";

import { motion } from "framer-motion";
import Header from "@/components/Header";
import ReservoirVisualization from "@/components/ReservoirVisualization";
import FarmAgentCards from "@/components/FarmAgentCards";
import ClimatePanel from "@/components/ClimatePanel";
import SystemMetrics from "@/components/SystemMetrics";
import FlowMap from "@/components/FlowMap";
import ControlSurface from "@/components/ControlSurface";
import MissionPanel from "@/components/MissionPanel";
import AgentActivityPanel from "@/components/AgentActivityPanel";
import { useBackendData } from "@/lib/useBackendData";

export default function HomePage() {
  const {
    data,
    setScenario,
    status,
    error,
    dataMode,
    setDataMode,
    selectedDayIndex,
    setSelectedDayIndex
  } = useBackendData();
  const selectedSignal =
    data.dailySignals[Math.min(Math.max(selectedDayIndex, 0), Math.max(data.dailySignals.length - 1, 0))] ??
    data.dailySignals[data.dailySignals.length - 1];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Header
        scenario={data.scenario}
        scenarios={data.scenarios}
        onScenarioChange={setScenario}
        dataMode={dataMode}
        onDataModeChange={setDataMode}
      />

      {status === "error" ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-3 text-sm text-rose-100">
          Backend connection failed. {error ?? ""}
        </div>
      ) : null}

      <motion.section
        className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <ReservoirVisualization
          reservoir={data.reservoir}
          day={data.day}
          timeline={data.reservoirTimeline}
          selectedIndex={selectedDayIndex}
          onSelectIndex={setSelectedDayIndex}
          liveSnapshot={data.liveReservoir}
        />
        <SystemMetrics metrics={data.metrics} />
      </motion.section>

      <motion.section
        className="grid gap-6 lg:grid-cols-[1.1fr_1fr]"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <FarmAgentCards farms={data.farms} />
        <ClimatePanel climate={data.climate} />
      </motion.section>

      <motion.section
        className="grid gap-6 lg:grid-cols-[1.2fr_1fr]"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <FlowMap flow={data.flow} />
        <ControlSurface />
      </motion.section>

      {selectedSignal ? (
        <motion.section
          className="grid gap-6 lg:grid-cols-[1fr_1fr]"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
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
