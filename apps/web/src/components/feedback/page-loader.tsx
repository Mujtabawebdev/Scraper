import { Spinner } from "../ui/spinner";

export interface PageLoaderProps {
  className?: string;
  fullScreen?: boolean;
  message?: string;
}

export function PageLoader({
  className,
  fullScreen = true,
  message = "Loading your workspace…",
}: PageLoaderProps) {
  return (
    <div
      aria-live="polite"
      className={[
        "flex items-center justify-center p-8",
        fullScreen ? "min-h-screen" : "min-h-56",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col items-center gap-3 text-center text-slate-600">
        <Spinner label="" size="lg" />
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}
