import type { DashboardState } from "./types";
import { clamp } from "./utils";

const scenarios = ["Balanced", "Yield Max", "Conservation", "Equity First"];

export const createInitialState = (): DashboardState => ({
  day: 12,
  scenario: "Balanced",
  scenarios,
  reservoir: {
    reservoir_level: 65.3,
    sustainability_threshold: 52,
    inflow: 12.4,
    outflow: 10.7
  },
  reservoirTimeline: [
    {
      day: 12,
      reservoir_level: 65.3,
      inflow: 12.4,
      outflow: 10.7
    }
  ],
  farms: [
    { id: "farm-1", name: "Delta Orchards", requested: 30, allocated: 25, yield: 18.4, fairness: 0.82 },
    { id: "farm-2", name: "Sierra Co-op", requested: 40, allocated: 35, yield: 22.1, fairness: 0.88 },
    { id: "farm-3", name: "Highland Fields", requested: 22, allocated: 18, yield: 13.9, fairness: 0.71 },
    { id: "farm-4", name: "Crescent Farms", requested: 28, allocated: 26, yield: 17.6, fairness: 0.93 }
  ],
  climate: {
    rainfall_probability: 0.42,
    drought_risk: 0.27,
    forecast: [
      { day: "Mon", rainfall_probability: 0.38, drought_risk: 0.32, temperature: 29 },
      { day: "Tue", rainfall_probability: 0.44, drought_risk: 0.3, temperature: 30 },
      { day: "Wed", rainfall_probability: 0.36, drought_risk: 0.35, temperature: 31 },
      { day: "Thu", rainfall_probability: 0.5, drought_risk: 0.28, temperature: 28 },
      { day: "Fri", rainfall_probability: 0.58, drought_risk: 0.24, temperature: 27 },
      { day: "Sat", rainfall_probability: 0.46, drought_risk: 0.3, temperature: 29 },
      { day: "Sun", rainfall_probability: 0.4, drought_risk: 0.33, temperature: 30 }
    ]
  },
  metrics: {
    total_yield: [92, 96, 98, 100, 97, 101, 104],
    sustainability_score: 0.76,
    gini_index: 0.18,
    depletion_risk: 0.25
  },
  flow: {
    nodes: [
      { id: "res", label: "Reservoir", type: "source" },
      { id: "hub", label: "Allocation Hub", type: "hub" },
      { id: "f1", label: "Delta", type: "sink" },
      { id: "f2", label: "Sierra", type: "sink" },
      { id: "f3", label: "Highland", type: "sink" },
      { id: "f4", label: "Crescent", type: "sink" }
    ],
    edges: [
      { from: "res", to: "hub", intensity: 0.9 },
      { from: "hub", to: "f1", intensity: 0.68 },
      { from: "hub", to: "f2", intensity: 0.72 },
      { from: "hub", to: "f3", intensity: 0.52 },
      { from: "hub", to: "f4", intensity: 0.6 }
    ]
  }
});

const jitter = (range: number) => (Math.random() - 0.5) * range;

export const advanceState = (state: DashboardState): DashboardState => {
  const reservoir_level = clamp(state.reservoir.reservoir_level + jitter(2), 45, 82);
  const inflow = clamp(state.reservoir.inflow + jitter(1.4), 8, 16);
  const outflow = clamp(state.reservoir.outflow + jitter(1.2), 9, 15);
  const rainfall_probability = clamp(state.climate.rainfall_probability + jitter(0.08), 0.2, 0.7);
  const drought_risk = clamp(state.climate.drought_risk + jitter(0.06), 0.15, 0.55);

  const farms = state.farms.map((farm) => {
    const allocated = clamp(farm.allocated + jitter(1.8), farm.requested * 0.6, farm.requested);
    const yieldValue = clamp(farm.yield + jitter(1.4), 10, 28);
    const fairness = clamp(farm.fairness + jitter(0.08), 0.6, 0.98);
    return {
      ...farm,
      allocated: Number(allocated.toFixed(1)),
      yield: Number(yieldValue.toFixed(1)),
      fairness: Number(fairness.toFixed(2))
    };
  });

  const total_yield = [...state.metrics.total_yield.slice(1), clamp(98 + jitter(8), 88, 112)];

  return {
    ...state,
    day: state.day + 1,
    reservoir: {
      ...state.reservoir,
      reservoir_level: Number(reservoir_level.toFixed(1)),
      inflow: Number(inflow.toFixed(1)),
      outflow: Number(outflow.toFixed(1))
    },
    reservoirTimeline: [
      ...state.reservoirTimeline,
      {
        day: state.day + 1,
        reservoir_level: Number(reservoir_level.toFixed(1)),
        inflow: Number(inflow.toFixed(1)),
        outflow: Number(outflow.toFixed(1))
      }
    ],
    farms,
    climate: {
      ...state.climate,
      rainfall_probability: Number(rainfall_probability.toFixed(2)),
      drought_risk: Number(drought_risk.toFixed(2))
    },
    metrics: {
      ...state.metrics,
      total_yield: total_yield.map((value) => Number(value.toFixed(1))),
      sustainability_score: Number(clamp(state.metrics.sustainability_score + jitter(0.05), 0.6, 0.9).toFixed(2)),
      gini_index: Number(clamp(state.metrics.gini_index + jitter(0.03), 0.1, 0.28).toFixed(2)),
      depletion_risk: Number(clamp(state.metrics.depletion_risk + jitter(0.04), 0.18, 0.4).toFixed(2))
    }
  };
};
