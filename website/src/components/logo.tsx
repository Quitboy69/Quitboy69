import { cn } from "@/lib/utils";
import { site } from "@/data/site";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
}

/** Wortmarke mit Signet — als Inline-SVG, damit es in jeder Größe scharf bleibt. */
export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        className="size-8 shrink-0"
        role="img"
        aria-label={`${site.name} Logo`}
      >
        <defs>
          <linearGradient id="aurora-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--aurora-1))" />
            <stop offset="55%" stopColor="hsl(var(--aurora-3))" />
            <stop offset="100%" stopColor="hsl(var(--aurora-2))" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="32" height="32" rx="9" fill="url(#aurora-logo)" />
        <path
          d="M8 21.5 13 11l5 10.5M10.6 18.2h4.8M20 21.5V10.5l4 5.5-4 5.5Z"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && (
        <span className="font-display text-lg font-bold tracking-tight">{site.name}</span>
      )}
    </span>
  );
}
