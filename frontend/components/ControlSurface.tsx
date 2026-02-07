"use client";

import { useEffect, useState } from "react";
import { fetchLlmHealth } from "@/lib/api";
import type { LiveFeedStatus } from "@/lib/types";
import GlassPanel from "./GlassPanel";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type EndpointStatus = "online" | "offline" | "checking";

type StatusState = {
  health: EndpointStatus;
  presets: EndpointStatus;
  weather: EndpointStatus;
  damsLive: EndpointStatus;
  simulateLive: EndpointStatus;
  llm: EndpointStatus;
  llmDetail: string | null;
  updatedAt: string | null;
};

type ControlSurfaceProps = {
  liveStatus: LiveFeedStatus;
};

const initialState: StatusState = {
  health: "checking",
  presets: "checking",
  weather: "checking",
  damsLive: "checking",
  simulateLive: "checking",
  llm: "checking",
  llmDetail: null,
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

const liveModeStyle: Record<LiveFeedStatus["mode"], string> = {
  live: "border-emerald-300/40 bg-emerald-400/15 text-emerald-100",
  "stale-cache": "border-amber-300/40 bg-amber-400/15 text-amber-100",
  "preset-fallback": "border-rose-300/40 bg-rose-400/15 text-rose-100"
};

export default function ControlSurface({ liveStatus }: ControlSurfaceProps) {
  const [status, setStatus] = useState<StatusState>(initialState);

  useEffect(() => {
    let active = true;

    const check = async () => {
      const controller = new AbortController();
      setStatus((prev) => ({
        ...prev,
        health: "checking",
        presets: "checking",
        weather: "checking",
        damsLive: "checking",
        simulateLive: "checking",
        llm: "checking"
      }));

      const health: Promise<EndpointStatus> = fetch(`${API_BASE_URL}/health`, { signal: controller.signal })
        .then((res): EndpointStatus => (res.ok ? "online" : "offline"))
        .catch((): EndpointStatus => "offline");

      const presets: Promise<EndpointStatus> = fetch(`${API_BASE_URL}/presets`, { signal: controller.signal })
        .then((res): EndpointStatus => (res.ok ? "online" : "offline"))
        .catch((): EndpointStatus => "offline");

      const weather: Promise<EndpointStatus> = fetch(`${API_BASE_URL}/weather/pakistan`, { signal: controller.signal })
        .then((res): EndpointStatus => (res.ok ? "online" : "offline"))
        .catch((): EndpointStatus => "offline");

      const damsLive: Promise<EndpointStatus> = fetch(`${API_BASE_URL}/data/dams/pakistan-live`, { signal: controller.signal })
        .then((res): EndpointStatus => (res.ok ? "online" : "offline"))
        .catch((): EndpointStatus => "offline");

      const simulateLive: Promise<EndpointStatus> = fetch(
        `${API_BASE_URL}/simulate/pakistan-live?policy=pakistan-quota&days=7&compare_policies=false`,
        { signal: controller.signal }
      )
        .then((res): EndpointStatus => (res.ok ? "online" : "offline"))
        .catch((): EndpointStatus => "offline");

      const llm = fetchLlmHealth(false)
        .then((res) => ({
          status: res.key_configured && res.reachable ? ("online" as EndpointStatus) : ("offline" as EndpointStatus),
          detail: res.detail ?? null
        }))
        .catch(() => ({ status: "offline" as EndpointStatus, detail: "Unable to query LLM health endpoint." }));

      const [healthStatus, presetsStatus, weatherStatus, damsLiveStatus, simulateLiveStatus, llmStatus] =
        await Promise.all([health, presets, weather, damsLive, simulateLive, llm]);

      controller.abort();
      if (!active) return;
      setStatus({
        health: healthStatus,
        presets: presetsStatus,
        weather: weatherStatus,
        damsLive: damsLiveStatus,
        simulateLive: simulateLiveStatus,
        llm: llmStatus.status,
        llmDetail: llmStatus.detail,
        updatedAt: formatTime(new Date())
      });
    };

    check();
    const interval = setInterval(check, 20000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const restEndpoints: { method: string; path: string; status: EndpointStatus }[] = [
    { method: "GET", path: "/health", status: status.health },
    { method: "GET", path: "/presets", status: status.presets },
    { method: "GET", path: "/weather/pakistan", status: status.weather },
    { method: "GET", path: "/data/dams/pakistan-live", status: status.damsLive },
    { method: "GET", path: "/simulate/pakistan-live", status: status.simulateLive },
    { method: "GET", path: "/llm/health", status: status.llm },
    { method: "POST", path: "/simulate", status: status.health === "online" ? "online" : "offline" },
    { method: "POST", path: "/stress-test", status: status.health === "online" ? "online" : "offline" }
  ];

  const llmEndpoints = [
    { method: "POST", path: "/negotiate" },
    { method: "POST", path: "/negotiate/multi" },
    { method: "POST", path: "/policy/brief" }
  ];

  return (
    <GlassPanel title="Control Surface" subtitle="Realtime protocol and reliability">
      <div className="flex flex-col gap-5 text-sm text-slate-300">
        <div className={`rounded-2xl border px-4 py-3 ${liveModeStyle[liveStatus.mode]}`}>
          <p className="text-xs uppercase tracking-[0.3em]">Data runtime status</p>
          <p className="mt-2 font-medium">{liveStatus.label}</p>
          <p className="mt-1 text-xs text-slate-200">{liveStatus.detail}</p>
        </div>

        <p>API health and simulation liveness checks refresh every 20 seconds.</p>

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
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">LLM actions</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-200">
            {llmEndpoints.map((endpoint) => (
              <span key={endpoint.path} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {endpoint.method} {endpoint.path}
              </span>
            ))}
          </div>
          {status.llmDetail ? <p className="mt-3 text-xs text-slate-400">{status.llmDetail}</p> : null}
        </div>

        <p className="text-xs text-slate-400">Last checked: {status.updatedAt ?? "--"}</p>
      </div>
    </GlassPanel>
  );
}
