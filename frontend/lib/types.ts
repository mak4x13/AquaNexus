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
};
