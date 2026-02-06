import { useEffect, useMemo, useState } from "react";
import type { DashboardState } from "./types";
import { clamp } from "./utils";
import { createInitialState } from "./mockData";
import {
  buildSimulationRequest,
  fetchPresets,
  getPakistanPreset,
  getFarmProfiles,
  runSimulationRequest,
  scenarioPolicyMap,
  type ScenarioPolicy,
  type SimulationRequest,
  type SimulationResponse
} from "./api";

const deriveClimateForecast = (daily: SimulationResponse["primary"]["daily"]) => {
  const recent = daily.slice(-7);
  if (recent.length === 0) {
    return {
      rainfall_probability: 0.3,
      drought_risk: 0.2,
      forecast: []
    };
  }

  const rainfallHits = recent.filter((day) => day.rainfall > 0).length;
  const droughtHits = recent.filter((day) => day.drought).length;

  const forecast = recent.map((day) => {
    const rainfallProb = clamp(day.rainfall / 40, 0, 1);
    const droughtRisk = day.drought ? 0.6 : 0.2;
    const temperature = clamp(33 - day.rainfall * 0.2, 24, 35);
    return {
      day: `D${day.day}`,
      rainfall_probability: Number(rainfallProb.toFixed(2)),
      drought_risk: Number(droughtRisk.toFixed(2)),
      temperature: Number(temperature.toFixed(1))
    };
  });

  return {
    rainfall_probability: Number((rainfallHits / recent.length).toFixed(2)),
    drought_risk: Number((droughtHits / recent.length).toFixed(2)),
    forecast
  };
};

const buildFlowState = (
  request: SimulationRequest,
  farms: Array<{ id: string; name: string; requested: number; allocated: number; group?: string }>
) => {
  const hubId = "hub";
  const sourceId = "reservoir";
  const maxAllocated = Math.max(...farms.map((farm) => farm.allocated), 1);

  const nodes = [
    { id: sourceId, label: "Reservoir", type: "source" as const },
    { id: hubId, label: "Allocation Hub", type: "hub" as const },
    ...farms.map((farm) => ({
      id: farm.id,
      label: farm.name,
      type: "sink" as const,
      group: farm.group
    }))
  ];

  const edges = [
    { from: sourceId, to: hubId, intensity: 0.85 },
    ...farms.map((farm) => ({
      from: hubId,
      to: farm.id,
      intensity: Number((farm.allocated / maxAllocated).toFixed(2))
    }))
  ];

  return { nodes, edges };
};

const mapSimulationToDashboard = (
  response: SimulationResponse,
  scenario: string,
  scenarios: string[],
  request: SimulationRequest
): DashboardState => {
  const base = createInitialState();
  const profiles = getFarmProfiles();
  const profileLookup = new Map(profiles.map((profile) => [profile.id, profile]));
  const daily = response.primary.daily;
  const lastDay = daily[daily.length - 1];

  const reservoirCapacity = request.config.reservoir_capacity;
  const reservoirLevelPct = reservoirCapacity > 0
    ? (lastDay.reservoir_end / reservoirCapacity) * 100
    : 0;

  const farms = response.primary.farms.map((farm) => {
    const profile = profileLookup.get(farm.id);
    const requestFarm = request.farms.find((item) => item.id === farm.id);
    const requested = requestFarm?.base_demand ?? profile?.base_demand ?? 0;
    const province = requestFarm?.province;
    const cropName = requestFarm?.crop_type ?? profile?.name ?? farm.id;
    const name = province ? `${province} ${cropName}` : cropName;
    const allocationRatio = requested > 0 ? farm.average_allocation / requested : 0;
    return {
      id: farm.id,
      name,
      requested,
      allocated: Number(farm.average_allocation.toFixed(1)),
      yield: Number(farm.average_yield.toFixed(1)),
      fairness: Number(clamp(allocationRatio, 0, 1).toFixed(2)),
      group: province
    };
  });

  const climate = deriveClimateForecast(daily);
  const reservoirTimeline = daily.map((day) => ({
    day: day.day,
    reservoir_level: Number(((day.reservoir_end / reservoirCapacity) * 100).toFixed(1)),
    inflow: Number(day.rainfall.toFixed(1)),
    outflow: Number(day.total_allocated.toFixed(1))
  }));

  return {
    day: lastDay.day,
    scenario,
    scenarios,
    reservoir: {
      reservoir_level: Number(reservoirLevelPct.toFixed(1)),
      sustainability_threshold: request.config.sustainability_threshold * 100,
      inflow: Number(lastDay.rainfall.toFixed(1)),
      outflow: Number(lastDay.total_allocated.toFixed(1))
    },
    reservoirTimeline,
    farms,
    climate,
    metrics: {
      total_yield: daily.map((day) => Number(day.total_yield.toFixed(1))),
      sustainability_score: Number(response.primary.summary.sustainability_score.toFixed(2)),
      gini_index: Number(response.primary.summary.avg_gini.toFixed(2)),
      depletion_risk: Number(lastDay.depletion_risk.toFixed(2))
    },
    flow: buildFlowState(request, farms)
  };
};

export const useBackendData = () => {
  const base = useMemo(() => createInitialState(), []);
  const [data, setData] = useState<DashboardState>(base);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState(base.scenario);
  const [dataMode, setDataMode] = useState<"default" | "pakistan">("default");
  const [pakistanPreset, setPakistanPreset] = useState<SimulationRequest | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  useEffect(() => {
    let active = true;

    const loadPresets = async () => {
      try {
        const presets = await fetchPresets();
        if (!active) return;
        setPakistanPreset(getPakistanPreset(presets));
      } catch (err) {
        if (!active) return;
        setPakistanPreset(null);
      }
    };

    loadPresets();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      setStatus("loading");
      setError(null);
      const policy = scenarioPolicyMap[scenario] ?? "fair";
      let request = buildSimulationRequest(policy);

      if (dataMode === "pakistan") {
        if (!pakistanPreset) {
          setStatus("error");
          setError("Pakistan preset not loaded yet.");
          return;
        }
        request = {
          ...pakistanPreset,
          policy,
          compare_policies: false
        };
      }

      try {
        const response = await runSimulationRequest(request);
        if (!active) return;
        const mapped = mapSimulationToDashboard(response, scenario, base.scenarios, request);
        setData(mapped);
        setSelectedDayIndex(Math.max(mapped.reservoirTimeline.length - 1, 0));
        setStatus("idle");
      } catch (err) {
        if (!active) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Unknown backend error");
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 6000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [base.scenarios, dataMode, pakistanPreset, scenario]);

  const updateScenario = (nextScenario: string) => {
    setScenario(nextScenario);
    setData((prev) => ({ ...prev, scenario: nextScenario }));
  };

  const updateDataMode = (mode: "default" | "pakistan") => {
    setDataMode(mode);
  };

  return {
    data,
    setScenario: updateScenario,
    status,
    error,
    dataMode,
    setDataMode: updateDataMode,
    selectedDayIndex,
    setSelectedDayIndex
  };
};
