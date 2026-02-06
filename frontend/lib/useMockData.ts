import { useEffect, useState } from "react";
import { advanceState, createInitialState } from "./mockData";
import type { DashboardState } from "./types";

export const useMockData = () => {
  const [data, setData] = useState<DashboardState>(() => createInitialState());

  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => advanceState(prev));
    }, 2400);

    return () => clearInterval(interval);
  }, []);

  const setScenario = (scenario: string) => {
    setData((prev) => ({ ...prev, scenario }));
  };

  return { data, setScenario };
};
