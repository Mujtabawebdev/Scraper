const clampProgress = (value: number): number =>
  Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

export interface JobProgressBarProps {
  label?: string;
  progress: number;
}

export function JobProgressBar({
  label = "Job progress",
  progress,
}: JobProgressBarProps) {
  const safeProgress = clampProgress(progress);

  return (
    <div className="min-w-32">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="sr-only">{label}</span>
        <span aria-hidden="true" className="text-slate-500">
          Progress
        </span>
        <span className="font-semibold text-slate-700">
          {Math.round(safeProgress)}%
        </span>
      </div>
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(safeProgress)}
        className="h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] motion-reduce:transition-none"
          style={{ width: `${safeProgress}%` }}
        />
      </div>
    </div>
  );
}
