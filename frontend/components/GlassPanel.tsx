type GlassPanelProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
};

export default function GlassPanel({ title, subtitle, children, className }: GlassPanelProps) {
  return (
    <div className={`glass-panel panel-grid p-6 ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{subtitle}</p>
          <h3 className="mt-3 text-2xl font-semibold">{title}</h3>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
