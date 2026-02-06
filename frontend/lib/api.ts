const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type ScenarioPolicy = "fair" | "equal" | "proportional" | "quota";

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
    name: "Delta Orchards",
    crop_type: "wheat",
    base_demand: 40,
    yield_a: 8,
    resilience: 0.62,
    province: "Punjab"
  },
  {
    id: "farm-2",
    name: "Sierra Co-op",
    crop_type: "rice",
    base_demand: 55,
    yield_a: 10,
    resilience: 0.5,
    province: "Sindh"
  },
  {
    id: "farm-3",
    name: "Highland Fields",
    crop_type: "maize",
    base_demand: 30,
    yield_a: 7,
    resilience: 0.68,
    province: "Punjab"
  },
  {
    id: "farm-4",
    name: "Crescent Farms",
    crop_type: "cotton",
    base_demand: 35,
    yield_a: 9,
    resilience: 0.58,
    province: "Sindh"
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
  province_quotas: { Punjab: 0.55, Sindh: 0.45 },
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

export const getPakistanPreset = (presets: PresetResponse[]): SimulationRequest | null => {
  const preferred = presets.find((preset) => preset.id === "pk-irrigation-auto-quota");
  if (preferred) return preferred.request;
  const fallback = presets.find((preset) => preset.id === "pk-irrigation-demo");
  return fallback?.request ?? null;
};
