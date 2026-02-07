import type { CSSProperties } from "react";
import GlassPanel from "./GlassPanel";
import type { FlowState } from "@/lib/types";

type FlowMapProps = {
  flow: FlowState;
};

const buildPositions = (flow: FlowState) => {
  const source = flow.nodes.find((node) => node.type === "source");
  const hub = flow.nodes.find((node) => node.type === "hub");
  const sinks = flow.nodes.filter((node) => node.type === "sink");

  const positions: Record<string, { x: number; y: number }> = {};
  if (source) positions[source.id] = { x: 48, y: 112 };
  if (hub) positions[hub.id] = { x: 168, y: 112 };

  const gap = sinks.length > 1 ? 176 / (sinks.length - 1) : 0;
  sinks.forEach((node, index) => {
    positions[node.id] = { x: 308, y: 24 + gap * index };
  });

  return positions;
};

const provinceColors: Record<string, string> = {
  Punjab: "#22c55e",
  Sindh: "#38bdf8",
  "Khyber Pakhtunkhwa": "#f97316",
  Balochistan: "#a855f7"
};

export default function FlowMap({ flow }: FlowMapProps) {
  const nodePositions = buildPositions(flow);

  return (
    <GlassPanel title="Interaction Flow Map" subtitle="Climate + reservoir signals routed through policy to province agents">
      <div className="grid gap-4">
        <div className="relative h-64 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-slate-950/80">
          <svg viewBox="0 0 360 224" className="h-full w-full">
            <defs>
              <linearGradient id="flow-base" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0ea5e9" />
              </linearGradient>
              <linearGradient id="flow-highlight" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#bae6fd" />
                <stop offset="100%" stopColor="#67e8f9" />
              </linearGradient>
            </defs>

            {flow.edges.map((edge, index) => {
              const from = nodePositions[edge.from];
              const to = nodePositions[edge.to];
              if (!from || !to) return null;

              const strokeWidth = 2 + edge.intensity * 2.8;
              const edgeDuration = Math.max(1.3, 3.2 - edge.intensity * 1.6);
              const edgeOpacity = 0.3 + edge.intensity * 0.55;
              const animatedStyle: CSSProperties = {
                animationDuration: `${edgeDuration.toFixed(2)}s`,
                opacity: Math.min(1, edgeOpacity + 0.15)
              };

              return (
                <g key={`${edge.from}-${edge.to}-${index}`}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="url(#flow-base)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    className="flow-edge-pulse"
                    style={{ opacity: edgeOpacity }}
                  />
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="url(#flow-highlight)"
                    strokeWidth={Math.max(1.2, strokeWidth - 1.6)}
                    strokeLinecap="round"
                    className="flow-edge-animated"
                    style={animatedStyle}
                  />
                </g>
              );
            })}

            {flow.nodes.map((node, index) => {
              const position = nodePositions[node.id];
              if (!position) return null;
              const color =
                node.type === "source"
                  ? "#38bdf8"
                  : node.type === "hub"
                    ? "#f59e0b"
                    : node.group && provinceColors[node.group]
                      ? provinceColors[node.group]
                      : "#22c55e";
              const pulseStyle: CSSProperties = {
                animationDuration: `${(2.4 + index * 0.18).toFixed(2)}s`
              };

              return (
                <g key={node.id}>
                  <circle cx={position.x} cy={position.y} r={17} fill={color} opacity={0.22} className="flow-node-pulse" style={pulseStyle} />
                  <circle cx={position.x} cy={position.y} r={11} fill={color} opacity={0.94} />
                  <text x={position.x + 16} y={position.y + 4} fill="#e2e8f0" fontSize={10}>
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-3 text-[11px] text-slate-300">
          <div className="flex flex-wrap items-center gap-3">
            <span className="uppercase tracking-[0.2em] text-slate-400">Flow legend</span>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1">Source: climate + reservoir</span>
            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1">Hub: policy allocator</span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1">Sinks: province farms</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(provinceColors).map(([province, color]) => (
              <span key={province} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                {province}
              </span>
            ))}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
