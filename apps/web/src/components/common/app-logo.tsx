import { Building2 } from "lucide-react";

export interface AppLogoProps {
  className?: string;
  compact?: boolean;
}

export function AppLogo({ className, compact = false }: AppLogoProps) {
  return (
    <span
      aria-label="US Business Lead SaaS"
      className={[
        "inline-flex items-center gap-2.5 text-slate-950",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="img"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
        <Building2 aria-hidden="true" className="size-5" />
      </span>
      {compact ? null : (
        <span className="text-base font-bold tracking-tight">
          Lead<span className="text-brand-600">SaaS</span>
        </span>
      )}
    </span>
  );
}
