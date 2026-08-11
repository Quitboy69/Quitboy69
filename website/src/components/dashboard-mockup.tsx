import { useEffect, useState } from "react";
import { ArrowUpRight, Circle, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/* Werte der Zeitreihe — bewusst fest verdrahtet, damit die Kurve immer gleich aussieht. */
const SERIES_A = [18, 24, 21, 32, 29, 41, 38, 52, 47, 61, 58, 74, 69, 86, 92];
const SERIES_B = [12, 15, 14, 19, 17, 24, 22, 29, 27, 33, 31, 39, 36, 44, 48];

const CHART_W = 560;
const CHART_H = 190;

/** Wandelt Werte in einen geglätteten SVG-Pfad (kubische Bézier durch Mittelpunkte). */
function buildPath(values: number[], close = false) {
  const max = Math.max(...values) * 1.15;
  const stepX = CHART_W / (values.length - 1);
  const points = values.map((value, index) => ({
    x: index * stepX,
    y: CHART_H - (value / max) * CHART_H,
  }));

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
  }

  if (close) path += ` L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`;
  return path;
}

const kpis = [
  { label: "Aktive Nutzer", value: "48.291", delta: "+12,4 %", positive: true },
  { label: "Aktivierungsrate", value: "63,8 %", delta: "+4,1 %", positive: true },
  { label: "Abwanderung", value: "1,9 %", delta: "−0,6 %", positive: true },
];

const funnelSteps = [
  { label: "Besuch", value: 100 },
  { label: "Registrierung", value: 74 },
  { label: "Aktivierung", value: 52 },
  { label: "Abo", value: 31 },
];

/**
 * Nachgebaute Produktoberfläche für den Hero.
 * Komplett in SVG und CSS gezeichnet — keine Screenshots, dadurch
 * gestochen scharf auf jedem Display und in beiden Themes korrekt.
 */
export function DashboardMockup({ className }: { className?: string }) {
  const [drawn, setDrawn] = useState(false);

  // Kurve erst nach dem Mount zeichnen, damit die Animation sichtbar startet.
  useEffect(() => {
    const timer = window.setTimeout(() => setDrawn(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card/90 shadow-lift backdrop-blur-xl",
        className,
      )}
      role="img"
      aria-label="Beispielansicht des Aurora-Dashboards mit Nutzerkurve, Kennzahlen und Trichter"
    >
      {/* Fensterleiste */}
      <div className="flex items-center gap-3 border-b bg-secondary/40 px-4 py-3">
        <div className="flex gap-1.5">
          <Circle className="size-2.5 fill-destructive/70 text-destructive/70" />
          <Circle className="size-2.5 fill-amber-400/80 text-amber-400/80" />
          <Circle className="size-2.5 fill-emerald-400/80 text-emerald-400/80" />
        </div>
        <div className="flex h-7 flex-1 items-center gap-2 rounded-full border bg-background/60 px-3">
          <Search className="size-3 text-muted-foreground" aria-hidden="true" />
          <span className="font-mono text-[11px] text-muted-foreground">
            app.aurora.dev/übersicht
          </span>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary sm:inline-flex">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full rounded-full bg-primary animate-pulse-ring" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          Live
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.55fr_1fr]">
        {/* Hauptdiagramm */}
        <div className="rounded-xl border bg-background/50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Aktive Nutzer · 30 Tage</p>
              <p className="mt-1 font-display text-2xl font-bold tracking-tight">48.291</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
              <ArrowUpRight className="size-3" aria-hidden="true" />
              12,4 %
            </span>
          </div>

          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="mt-4 h-32 w-full sm:h-40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="area-a" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.34" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="line-a" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--aurora-1))" />
                <stop offset="100%" stopColor="hsl(var(--aurora-3))" />
              </linearGradient>
            </defs>

            {/* Hilfslinien */}
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line
                key={ratio}
                x1="0"
                x2={CHART_W}
                y1={CHART_H * ratio}
                y2={CHART_H * ratio}
                stroke="hsl(var(--border))"
                strokeWidth="1"
                strokeDasharray="4 6"
              />
            ))}

            <path d={buildPath(SERIES_A, true)} fill="url(#area-a)" />
            <path
              d={buildPath(SERIES_B)}
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity="0.45"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
            <path
              d={buildPath(SERIES_A)}
              fill="none"
              stroke="url(#line-a)"
              strokeWidth="3"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={drawn ? 0 : 1}
              style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(0.16, 1, 0.3, 1)" }}
            />
          </svg>

          <div className="mt-3 flex justify-between font-mono text-[10px] text-muted-foreground">
            {["1. Mai", "8. Mai", "15. Mai", "22. Mai", "30. Mai"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>

        {/* Seitenspalte */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border bg-background/50 p-3">
                <p className="truncate text-[11px] text-muted-foreground">{kpi.label}</p>
                <p className="mt-0.5 font-display text-base font-bold">{kpi.value}</p>
                <p
                  className={cn(
                    "text-[11px] font-medium",
                    kpi.positive ? "text-emerald-500" : "text-destructive",
                  )}
                >
                  {kpi.delta}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border bg-background/50 p-3">
            <p className="text-[11px] text-muted-foreground">Aktivierungs-Trichter</p>
            <div className="mt-2.5 space-y-2">
              {funnelSteps.map((step, index) => (
                <div key={step.label}>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{step.label}</span>
                    <span className="font-mono font-medium">{step.value} %</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-1000 ease-out"
                      style={{
                        width: drawn ? `${step.value}%` : "0%",
                        transitionDelay: `${400 + index * 120}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-primary/25 bg-primary/[0.07] p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
              <Sparkles className="size-3" aria-hidden="true" />
              KI-Insight
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Nutzer aus der Kampagne <span className="text-foreground">spring-launch</span>{" "}
              aktivieren 2,3-mal häufiger. Budget verschieben?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
