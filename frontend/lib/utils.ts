export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const formatPct = (value: number) => `${Math.round(value * 100)}%`;

export const formatNumber = (value: number, digits = 1) => value.toFixed(digits);
