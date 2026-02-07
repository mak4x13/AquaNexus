import { useEffect, useMemo, useState } from "react";
import type { DashboardState } from "./types";
import { clamp } from "./utils";
import { createInitialState } from "./mockData";
import {
  buildSimulationRequest,
  fetchPakistanLiveSimulation,
  fetchPakistanWeather,
  fetchPresets,
  getPakistanPreset,
  getFarmProfiles,
  runSimulationRequest,
  scenarioPolicyMap,
  type PakistanLiveDamResponse,
  type PakistanWeatherResponse,
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

const buildPakistanClimate = (
  daily: SimulationResponse["primary"]["daily"],
  weather: PakistanWeatherResponse | null
) => {
  const base = deriveClimateForecast(daily);
  if (!weather || weather.provinces.length === 0) {
    return { ...base, source: "simulation", provinceWeather: [] };
  }

  const avgRain = weather.provinces.reduce((sum, row) => sum + row.precipitation_mm, 0) / weather.provinces.length;
  const avgRisk = weather.provinces.reduce((sum, row) => sum + row.drought_risk, 0) / weather.provinces.length;

  return {
    ...base,
    source: weather.source,
    rainfall_probability: Number(clamp(avgRain / 12, 0, 1).toFixed(2)),
    drought_risk: Number(clamp(avgRisk, 0, 1).toFixed(2)),
    provinceWeather: weather.provinces.map((row) => ({
      province: row.province,
      city: row.city,
      temperature_c: Number(row.temperature_c.toFixed(1)),
      precipitation_mm: Number(row.precipitation_mm.toFixed(1)),
      drought_risk: Number(row.drought_risk.toFixed(2))
    }))
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
  request: SimulationRequest,
  weather: PakistanWeatherResponse | null,
  liveDamData: PakistanLiveDamResponse | null = null
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

  const climate = buildPakistanClimate(daily, weather);
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
    flow: buildFlowState(request, farms),
    liveReservoir: liveDamData
      ? {
          source: liveDamData.source,
          updated_at_pkt: liveDamData.updated_at_pkt ?? null,
          fetched_at_utc: liveDamData.fetched_at_utc,
          notes: [...liveDamData.notes],
          stations: liveDamData.stations.map((station) => ({
            dam: station.dam,
            inflow_cusecs: station.inflow_cusecs,
            outflow_cusecs: station.outflow_cusecs,
            current_level_ft: station.current_level_ft ?? null,
            estimated_storage_maf: station.estimated_storage_maf ?? null
          }))
        }
      : undefined,
    dailySignals: daily.map((day) => ({
      day: day.day,
      rainfall: Number(day.rainfall.toFixed(1)),
      drought: day.drought,
      total_allocated: Number(day.total_allocated.toFixed(1)),
      depletion_risk: Number(day.depletion_risk.toFixed(2)),
      gini: Number(day.gini.toFixed(2))
    })),
    objective: {
      purpose: liveDamData?.updated_at_pkt
        ? `Help Pakistan allocate scarce water across provinces using live FFD snapshot (${liveDamData.updated_at_pkt}) plus policy simulation.`
        : "Help Pakistan allocate scarce water across provinces while maximizing yield, equity, and drought resilience.",
      beneficiaries: [
        "Farmers with predictable allocations",
        "Canal tail-end communities with fairer access",
        "Provincial planners with quantified trade-offs"
      ],
      scalePath: [
        "Connect district canal and crop registries",
        "Add province-level policy and budget constraints",
        "Run seasonal planning using live weather forecasts",
        "Ingest daily FFD/WAPDA records into audited policy workflows"
      ]
    }
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
  const [weather, setWeather] = useState<PakistanWeatherResponse | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

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

    const loadWeather = async () => {
      try {
        const live = await fetchPakistanWeather();
        if (!active) return;
        setWeather(live);
      } catch {
        if (!active) return;
        setWeather(null);
      }
    };

    loadWeather();
    const interval = setInterval(loadWeather, 15 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      setStatus("loading");
      setError(null);
      try {
        const policy = scenarioPolicyMap[scenario] ?? "fair";
        let request = buildSimulationRequest(policy);
        let response: SimulationResponse;
        let liveDamData: PakistanLiveDamResponse | null = null;

        if (dataMode === "pakistan") {
          const pakistanPolicy = scenario === "Equity First" ? "pakistan-quota" : policy;
          try {
            const liveResult = await fetchPakistanLiveSimulation(pakistanPolicy, 30, false);
            request = liveResult.request;
            response = liveResult.simulation;
            liveDamData = liveResult.live_data;
          } catch (liveErr) {
            if (!pakistanPreset) {
              throw liveErr;
            }
            request = {
              ...pakistanPreset,
              policy: pakistanPolicy,
              compare_policies: false
            };
            response = await runSimulationRequest(request);
            setError("Live dam source unavailable. Showing Pakistan preset fallback.");
          }
        } else {
          response = await runSimulationRequest(request);
        }

        if (!active) return;
        const mapped = mapSimulationToDashboard(
          response,
          scenario,
          base.scenarios,
          request,
          weather,
          liveDamData
        );
        setData(mapped);
        setSelectedDayIndex((prev) => {
          const latest = Math.max(mapped.reservoirTimeline.length - 1, 0);
          if (prev === null) return latest;
          return Math.min(prev, latest);
        });
        setStatus("idle");
      } catch (err) {
        if (!active) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Unknown backend error");
      }
    };

    fetchData();
    const intervalMs = dataMode === "pakistan" ? 30000 : 6000;
    const interval = setInterval(fetchData, intervalMs);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [base.scenarios, dataMode, pakistanPreset, scenario, weather]);

  const updateSelectedDayIndex = (nextIndex: number | null) => {
    setSelectedDayIndex(nextIndex);
  };

  const updateScenario = (nextScenario: string) => {
    setScenario(nextScenario);
    setSelectedDayIndex(null);
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
    selectedDayIndex: selectedDayIndex ?? Math.max(data.reservoirTimeline.length - 1, 0),
    setSelectedDayIndex: updateSelectedDayIndex
  };
};
