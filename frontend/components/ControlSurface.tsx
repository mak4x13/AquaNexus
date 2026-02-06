"use client";

import { useEffect, useState } from "react";
import GlassPanel from "./GlassPanel";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type EndpointStatus = "online" | "offline" | "checking";

type StatusState = {
  health: EndpointStatus;
  presets: EndpointStatus;
  updatedAt: string | null;
};

const initialState: StatusState = {
  health: "checking",
  presets: "checking",
  updatedAt: null
};

const formatTime = (value: Date) =>
  value.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

const statusBadge = (status: EndpointStatus) => {
  switch (status) {
    case "online":
      return "bg-emerald-400/20 text-emerald-200 border-emerald-400/40";
    case "offline":
      return "bg-rose-400/20 text-rose-200 border-rose-400/40";
    default:
      return "bg-slate-400/20 text-slate-200 border-slate-400/40";
  }
};

const statusLabel = (status: EndpointStatus) => {
  switch (status) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    default:
      return "Checking";
  }
};

export default function ControlSurface() {
  const [status, setStatus] = useState<StatusState>(initialState);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const check = async () => {
      setStatus((prev) => ({ ...prev, health: "checking", presets: "checking" }));

      const health: Promise<EndpointStatus> = fetch(`${API_BASE_URL}/health`, { signal: controller.signal })
        .then((res): EndpointStatus => (res.ok ? "online" : "offline"))
        .catch((): EndpointStatus => "offline");

      const presets: Promise<EndpointStatus> = fetch(`${API_BASE_URL}/presets`, { signal: controller.signal })
        .then((res): EndpointStatus => (res.ok ? "online" : "offline"))
        .catch((): EndpointStatus => "offline");

      const [healthStatus, presetsStatus] = await Promise.all([health, presets]);
      if (!active) return;
      setStatus({
        health: healthStatus,
        presets: presetsStatus,
        updatedAt: formatTime(new Date())
      });
    };

    check();
    const interval = setInterval(check, 12000);

    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const restEndpoints: { method: string; path: string; status: EndpointStatus }[] = [
    { method: "GET", path: "/health", status: status.health },
    { method: "GET", path: "/presets", status: status.presets },
    { method: "POST", path: "/simulate", status: status.health === "online" ? "online" : "offline" },
    { method: "POST", path: "/stress-test", status: status.health === "online" ? "online" : "offline" }
  ];

  const llmEndpoints = [
    { method: "POST", path: "/negotiate" },
    { method: "POST", path: "/negotiate/multi" },
    { method: "POST", path: "/policy/brief" }
  ];

  return (
    <GlassPanel title="Control Surface" subtitle="Realtime protocol">
      <div className="flex flex-col gap-5 text-sm text-slate-300">
        <p>
          REST triggers initialize and scenario toggles. Live status updates every 12 seconds.
        </p>
        <div className="grid gap-3">
          {restEndpoints.map((endpoint) => (
            <div key={endpoint.path} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-[0.3em] text-slate-400">{endpoint.method}</span>
                <span className="text-sm text-slate-200">{endpoint.path}</span>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusBadge(endpoint.status)}`}>
                {statusLabel(endpoint.status)}
              </span>
            </div>
          ))}
        </div>
        <div className="soft-divider pt-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">LLM</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-200">
            {llmEndpoints.map((endpoint) => (
              <span key={endpoint.path} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {endpoint.method} {endpoint.path}
              </span>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Last checked: {status.updatedAt ?? "--"}
        </p>
      </div>
    </GlassPanel>
  );
}
