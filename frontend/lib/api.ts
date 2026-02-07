const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type ScenarioPolicy = "fair" | "equal" | "proportional" | "quota" | "pakistan-quota";

export type SimulationRequest = {
  farms: Array<{
    id: string;
    crop_type: string;
    base_demand: number;
    yield_a: number;
    resilience?: number;
    province?: string;
  }>;
  config: {
    days: number;
    reservoir_capacity: number;
    initial_reservoir: number;
    max_daily_allocation: number;
    rainfall_prob: number;
    rainfall_mean: number;
    rainfall_std: number;
    drought_prob: number;
    drought_multiplier: number;
    drought_demand_reduction: number;
    conveyance_loss_rate: number;
    sustainability_threshold: number;
    alpha: number;
    beta: number;
    fairness_weight: number;
    province_quotas?: Record<string, number>;
    quota_mode?: "share" | "absolute";
    groundwater_capacity: number;
    initial_groundwater: number;
    max_groundwater_pumping: number;
    groundwater_recharge: number;
    groundwater_penalty_weight: number;
    external_inflow_series?: number[];
    seed?: number;
  };
  policy: ScenarioPolicy;
  compare_policies: boolean;
};

export type SimulationResponse = {
  primary: {
    summary: {
      policy: string;
      total_yield: number;
      avg_gini: number;
      avg_depletion_risk: number;
      final_reservoir: number;
      final_groundwater: number;
      sustainability_score: number;
      total_conveyance_loss: number;
      total_groundwater_used: number;
    };
    daily: Array<{
      day: number;
      rainfall: number;
      drought: boolean;
      reservoir_start: number;
      reservoir_end: number;
      groundwater_end: number;
      total_allocated: number;
      total_yield: number;
      conveyance_loss: number;
      groundwater_used: number;
      gini: number;
      depletion_risk: number;
      score: number;
    }>;
    farms: Array<{
      id: string;
      crop_type: string;
      total_allocated: number;
      total_yield: number;
      average_allocation: number;
      average_yield: number;
      unmet_demand_total: number;
    }>;
  };
  comparisons: Array<unknown>;
};

export type LlmHealthResponse = {
  key_configured: boolean;
  model: string;
  probe_attempted: boolean;
  reachable: boolean;
  detail?: string | null;
};

export type ProvinceWeather = {
  province: "Punjab" | "Sindh" | "Khyber Pakhtunkhwa" | "Balochistan";
  city: string;
  latitude: number;
  longitude: number;
  temperature_c: number;
  precipitation_mm: number;
  windspeed_kmh: number;
  drought_risk: number;
};

export type PakistanWeatherResponse = {
  source: string;
  timestamp_utc: string;
  provinces: ProvinceWeather[];
};

export type LiveDamStation = {
  dam: string;
  inflow_cusecs: number;
  outflow_cusecs: number;
  current_level_ft?: number | null;
  estimated_storage_maf?: number | null;
};

export type PakistanLiveDamResponse = {
  source: string;
  source_url: string;
  fetched_at_utc: string;
  updated_at_pkt?: string | null;
  stations: LiveDamStation[];
  notes: string[];
};

export type PakistanLiveSimulationResponse = {
  live_data: PakistanLiveDamResponse;
  request: SimulationRequest;
  simulation: SimulationResponse;
};

export type PresetResponse = {
  id: string;
  name: string;
  description: string;
  request: SimulationRequest;
};

export type FarmProfile = {
  id: string;
  name: string;
  crop_type: string;
  base_demand: number;
  yield_a: number;
  resilience: number;
  province: string;
};

export const scenarioPolicyMap: Record<string, ScenarioPolicy> = {
  Balanced: "fair",
  "Yield Max": "proportional",
  Conservation: "equal",
  "Equity First": "quota"
};

const farmProfiles: FarmProfile[] = [
  {
    id: "farm-1",
    name: "Punjab Wheat Cluster",
    crop_type: "wheat",
    base_demand: 42,
    yield_a: 8,
    resilience: 0.62,
    province: "Punjab"
  },
  {
    id: "farm-2",
    name: "Sindh Rice Corridor",
    crop_type: "rice",
    base_demand: 58,
    yield_a: 10,
    resilience: 0.42,
    province: "Sindh"
  },
  {
    id: "farm-3",
    name: "KP Maize Belt",
    crop_type: "maize",
    base_demand: 34,
    yield_a: 7.8,
    resilience: 0.55,
    province: "Khyber Pakhtunkhwa"
  },
  {
    id: "farm-4",
    name: "Balochistan Orchard Zone",
    crop_type: "orchard",
    base_demand: 26,
    yield_a: 6.8,
    resilience: 0.66,
    province: "Balochistan"
  }
];

const configDefaults: SimulationRequest["config"] = {
  days: 30,
  reservoir_capacity: 1200,
  initial_reservoir: 800,
  max_daily_allocation: 140,
  rainfall_prob: 0.3,
  rainfall_mean: 20,
  rainfall_std: 6,
  drought_prob: 0.1,
  drought_multiplier: 0.5,
  drought_demand_reduction: 0.25,
  conveyance_loss_rate: 0.2,
  sustainability_threshold: 0.2,
  alpha: 1.0,
  beta: 1.0,
  fairness_weight: 0.6,
  province_quotas: {
    Punjab: 0.48,
    Sindh: 0.38,
    "Khyber Pakhtunkhwa": 0.09,
    Balochistan: 0.05
  },
  quota_mode: "share",
  groundwater_capacity: 300,
  initial_groundwater: 200,
  max_groundwater_pumping: 20,
  groundwater_recharge: 3,
  groundwater_penalty_weight: 0.5,
  seed: 42
};

export const getFarmProfiles = () => farmProfiles;

export const buildSimulationRequest = (policy: ScenarioPolicy): SimulationRequest => ({
  farms: farmProfiles.map(({ name, ...farm }) => farm),
  config: configDefaults,
  policy,
  compare_policies: false
});

export const runSimulationRequest = async (request: SimulationRequest): Promise<SimulationResponse> => {
  const response = await fetch(`${API_BASE_URL}/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Backend error ${response.status}: ${detail}`);
  }

  return response.json() as Promise<SimulationResponse>;
};

export const runSimulation = async (policy: ScenarioPolicy): Promise<SimulationResponse> =>
  runSimulationRequest(buildSimulationRequest(policy));

export const fetchPresets = async (): Promise<PresetResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/presets`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Preset fetch failed ${response.status}: ${detail}`);
  }
  return response.json() as Promise<PresetResponse[]>;
};

export const fetchPakistanWeather = async (): Promise<PakistanWeatherResponse> => {
  const response = await fetch(`${API_BASE_URL}/weather/pakistan`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Weather fetch failed ${response.status}: ${detail}`);
  }
  return response.json() as Promise<PakistanWeatherResponse>;
};

export const fetchPakistanLiveDamData = async (): Promise<PakistanLiveDamResponse> => {
  const response = await fetch(`${API_BASE_URL}/data/dams/pakistan-live`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Live dam fetch failed ${response.status}: ${detail}`);
  }
  return response.json() as Promise<PakistanLiveDamResponse>;
};

export const fetchPakistanLiveSimulation = async (
  policy: ScenarioPolicy,
  days = 30,
  comparePolicies = false
): Promise<PakistanLiveSimulationResponse> => {
  const url = new URL(`${API_BASE_URL}/simulate/pakistan-live`);
  url.searchParams.set("policy", policy);
  url.searchParams.set("days", String(days));
  url.searchParams.set("compare_policies", String(comparePolicies));
  const response = await fetch(url.toString());
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Live simulation failed ${response.status}: ${detail}`);
  }
  return response.json() as Promise<PakistanLiveSimulationResponse>;
};

export const fetchLlmHealth = async (probe = false): Promise<LlmHealthResponse> => {
  const url = new URL(`${API_BASE_URL}/llm/health`);
  if (probe) {
    url.searchParams.set("probe", "true");
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LLM health fetch failed ${response.status}: ${detail}`);
  }
  return response.json() as Promise<LlmHealthResponse>;
};

export const getPakistanPreset = (presets: PresetResponse[]): SimulationRequest | null => {
  const preferred = presets.find((preset) => preset.id === "pk-irrigation-auto-quota");
  if (preferred) return preferred.request;
  const fallback = presets.find((preset) => preset.id === "pk-irrigation-demo");
  return fallback?.request ?? null;
};
