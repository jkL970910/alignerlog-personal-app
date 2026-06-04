type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <div className="rounded-md border border-ink/10 bg-white/80 p-4 shadow-sm">
      <p className="text-xs font-medium uppercase text-ink/50">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      {helper ? <p className="mt-1 text-sm text-ink/60">{helper}</p> : null}
    </div>
  );
}
