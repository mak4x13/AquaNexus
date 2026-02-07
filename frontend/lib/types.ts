export type ReservoirState = {
  reservoir_level: number;
  sustainability_threshold: number;
  inflow: number;
  outflow: number;
};

export type ReservoirTimelinePoint = {
  day: number;
  reservoir_level: number;
  inflow: number;
  outflow: number;
};

export type Farm = {
  id: string;
  name: string;
  requested: number;
  allocated: number;
  yield: number;
  fairness: number;
};

export type ClimatePoint = {
  day: string;
  rainfall_probability: number;
  drought_risk: number;
  temperature: number;
};

export type ClimateState = {
  rainfall_probability: number;
  drought_risk: number;
  forecast: ClimatePoint[];
  source?: string;
  provinceWeather?: Array<{
    province: string;
    city: string;
    temperature_c: number;
    precipitation_mm: number;
    drought_risk: number;
  }>;
};

export type MetricsState = {
  total_yield: number[];
  sustainability_score: number;
  gini_index: number;
  depletion_risk: number;
};

export type FlowNode = {
  id: string;
  label: string;
  type: "source" | "hub" | "sink";
  group?: string;
};

export type FlowEdge = {
  from: string;
  to: string;
  intensity: number;
};

export type FlowState = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type LiveReservoirSnapshot = {
  source: string;
  updated_at_pkt?: string | null;
  fetched_at_utc: string;
  notes: string[];
  stations: Array<{
    dam: string;
    inflow_cusecs: number;
    outflow_cusecs: number;
    current_level_ft?: number | null;
    estimated_storage_maf?: number | null;
  }>;
};

export type DashboardState = {
  day: number;
  scenario: string;
  scenarios: string[];
  reservoir: ReservoirState;
  reservoirTimeline: ReservoirTimelinePoint[];
  farms: Farm[];
  climate: ClimateState;
  metrics: MetricsState;
  flow: FlowState;
  liveReservoir?: LiveReservoirSnapshot;
  dailySignals: Array<{
    day: number;
    rainfall: number;
    drought: boolean;
    total_allocated: number;
    depletion_risk: number;
    gini: number;
  }>;
  objective: {
    purpose: string;
    beneficiaries: string[];
    scalePath: string[];
  };
};
