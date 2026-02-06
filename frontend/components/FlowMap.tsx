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
  if (source) positions[source.id] = { x: 50, y: 110 };
  if (hub) positions[hub.id] = { x: 165, y: 110 };

  const gap = sinks.length > 1 ? 180 / (sinks.length - 1) : 0;
  sinks.forEach((node, index) => {
    positions[node.id] = { x: 290, y: 20 + gap * index };
  });

  return positions;
};

export default function FlowMap({ flow }: FlowMapProps) {
  const nodePositions = buildPositions(flow);
  const provinceColors: Record<string, string> = {
    Punjab: "#22c55e",
    Sindh: "#38bdf8",
    Khyber: "#f97316",
    Balochistan: "#a855f7"
  };
  return (
    <GlassPanel title="Interaction Flow Map" subtitle="Allocation routing">
      <div className="relative h-60 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-slate-950/80">
        <svg viewBox="0 0 340 220" className="h-full w-full">
          <defs>
            <linearGradient id="flow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>
          {flow.edges.map((edge, index) => {
            const from = nodePositions[edge.from];
            const to = nodePositions[edge.to];
            if (!from || !to) return null;
            const strokeWidth = 2 + edge.intensity * 2.5;
            return (
              <line
                key={`${edge.from}-${edge.to}-${index}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="url(#flow)"
                strokeWidth={strokeWidth}
                strokeDasharray="8 6"
              />
            );
          })}
          {flow.nodes.map((node) => {
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
            return (
              <g key={node.id}>
                <circle cx={position.x} cy={position.y} r={12} fill={color} opacity={0.9} />
                <text x={position.x + 16} y={position.y + 4} fill="#e2e8f0" fontSize={10}>
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="absolute bottom-3 left-4 text-xs uppercase tracking-[0.3em] text-slate-400">
          Live allocation intensity
        </div>
      </div>
    </GlassPanel>
  );
}
