import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Database,
  MousePointer2,
  Pause,
  Play,
  Server,
  Sparkles,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PanelProps {
  className?: string;
}

const panelShell =
  "overflow-hidden rounded-2xl border bg-card shadow-card";

/* ------------------------- Panel 1: Frage zu SQL ------------------------- */

const QUESTION = "Warum ist die Aktivierung bei Android gefallen?";

const GENERATED_SQL = [
  "SELECT platform,",
  "       date_trunc('week', activated_at) AS woche,",
  "       count(*) FILTER (WHERE activated) * 1.0 / count(*) AS rate",
  "FROM   nutzer_events",
  "WHERE  activated_at > now() - interval '8 weeks'",
  "GROUP  BY 1, 2 ORDER BY 2;",
];

/** Tippt die Frage Zeichen für Zeichen und deckt danach den SQL auf. */
/** Einmalig beim ersten Rendern auswerten, nicht erst im Effekt. */
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function InsightPanel({ className }: PanelProps) {
  // Bei reduzierter Bewegung steht das Ergebnis sofort da, ohne Tippanimation.
  const [reduced] = useState(prefersReducedMotion);
  const [typed, setTyped] = useState(() => (reduced ? QUESTION : ""));
  const [showResult, setShowResult] = useState(reduced);
  const containerRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  // Erst starten, wenn das Panel wirklich sichtbar ist.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || reduced) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (!started) return;
    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setTyped(QUESTION.slice(0, index));
      if (index >= QUESTION.length) {
        window.clearInterval(interval);
        window.setTimeout(() => setShowResult(true), 450);
      }
    }, 38);
    return () => window.clearInterval(interval);
  }, [started]);

  return (
    // min-h reserviert den Platz für die Antwort — sonst springt das
    // Layout, sobald der generierte SQL eingeblendet wird.
    <div ref={containerRef} className={cn(panelShell, "min-h-[26rem]", className)}>
      <div className="border-b bg-secondary/40 px-4 py-3">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Aurora fragen
        </p>
      </div>

      <div className="p-4 sm:p-5">
        <div className="rounded-xl border bg-background/60 px-4 py-3">
          <p className="font-mono text-sm">
            {typed}
            <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-primary align-middle" />
          </p>
        </div>

        <div
          className={cn(
            "transition-all duration-500",
            showResult ? "mt-4 opacity-100" : "mt-0 h-0 overflow-hidden opacity-0",
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">Generierte Abfrage</p>
          <pre className="mt-2 overflow-x-auto rounded-xl border bg-secondary/50 p-3.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
            <code>
              {GENERATED_SQL.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </code>
          </pre>

          <div className="mt-3 rounded-xl border border-primary/25 bg-primary/[0.07] p-3.5">
            <p className="text-xs leading-relaxed">
              <span className="font-medium text-primary">Antwort: </span>
              <span className="text-muted-foreground">
                Android fällt seit dem 12. Mai um 8,4 Punkte. Betroffen sind fast ausschließlich
                Geräte mit App-Version 4.2.0 — dort bricht der Login-Schritt ab.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Panel 2: Session Replay ------------------------ */

const replayEvents = [
  { time: "00:04", label: "Seite geöffnet", tone: "muted" },
  { time: "00:19", label: "Formular ausgefüllt", tone: "muted" },
  { time: "00:41", label: "Rage-Click auf „Weiter“", tone: "warn" },
  { time: "00:47", label: "Fehler 500 im Checkout", tone: "error" },
] as const;

export function ReplayPanel({ className }: PanelProps) {
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(18);

  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      setProgress((value) => (value >= 100 ? 0 : value + 0.7));
    }, 60);
    return () => window.clearInterval(interval);
  }, [playing]);

  return (
    <div className={cn(panelShell, className)}>
      {/* „Video“-Fläche */}
      <div className="relative aspect-[16/10] overflow-hidden bg-secondary/50 bg-dots">
        {/* nachgebaute Seite in der Aufzeichnung */}
        <div className="absolute inset-0 p-5">
          <div className="h-3 w-24 rounded-full bg-muted-foreground/25" />
          <div className="mt-4 space-y-2">
            <div className="h-2.5 w-3/4 rounded-full bg-muted-foreground/15" />
            <div className="h-2.5 w-2/3 rounded-full bg-muted-foreground/15" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="h-16 rounded-lg border bg-background/70" />
            <div className="h-16 rounded-lg border bg-background/70" />
          </div>
          <div className="mt-4 h-9 w-32 rounded-full bg-primary/25" />
        </div>

        {/* Mauszeiger mit Klick-Welle */}
        <div
          className="absolute left-[26%] top-[72%] transition-transform duration-500"
          style={{ transform: `translate(${Math.sin(progress / 9) * 14}px, 0)` }}
        >
          <span className="absolute -left-2 -top-2 size-8 rounded-full bg-destructive/25 animate-pulse-ring" />
          <MousePointer2
            className="relative size-5 fill-foreground text-foreground"
            aria-hidden="true"
          />
        </div>

        <span className="absolute right-3 top-3 rounded-full bg-destructive/90 px-2.5 py-1 text-[10px] font-medium text-destructive-foreground">
          Rage-Click erkannt
        </span>
      </div>

      {/* Steuerleiste */}
      <div className="flex items-center gap-3 border-t bg-card px-4 py-3">
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? "Aufzeichnung pausieren" : "Aufzeichnung abspielen"}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">01:12</span>
        <Volume2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </div>

      {/* Ereignisliste */}
      <ul className="divide-y border-t">
        {replayEvents.map((event) => (
          <li key={event.time} className="flex items-center gap-3 px-4 py-2.5">
            <span className="font-mono text-[11px] text-muted-foreground">{event.time}</span>
            <span
              className={cn(
                "size-1.5 rounded-full",
                event.tone === "muted" && "bg-muted-foreground/40",
                event.tone === "warn" && "bg-amber-400",
                event.tone === "error" && "bg-destructive",
              )}
            />
            <span
              className={cn(
                "text-xs",
                event.tone === "error" ? "font-medium text-destructive" : "text-muted-foreground",
              )}
            >
              {event.label}
            </span>
            {event.tone === "error" && (
              <AlertTriangle className="ml-auto size-3.5 text-destructive" aria-hidden="true" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------- Panel 3: Technik ---------------------------- */

const latencyBars = [28, 34, 31, 26, 39, 22, 30, 25, 36, 29, 24, 33];

export function ScalePanel({ className }: PanelProps) {
  return (
    <div className={cn(panelShell, "p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Query-Latenz p95</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight">
            38<span className="ml-1 text-base font-medium text-muted-foreground">ms</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-500">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Alle Regionen normal
        </span>
      </div>

      {/* Latenz-Balken */}
      <div className="mt-6 flex h-24 items-end gap-1.5">
        {latencyBars.map((value, index) => (
          <div
            key={index}
            className="flex-1 rounded-t-sm bg-gradient-to-t from-primary/25 to-primary transition-all duration-500 hover:from-accent/30 hover:to-accent"
            style={{ height: `${(value / 40) * 100}%` }}
            title={`${value} ms`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>−12 h</span>
        <span>jetzt</span>
      </div>

      {/* Infrastruktur-Zeilen */}
      <ul className="mt-6 space-y-2.5 border-t pt-5">
        {[
          { icon: Server, label: "Region", value: "eu-central-1 · Frankfurt" },
          { icon: Database, label: "Engine", value: "spaltenorientiert, 38 Mrd. Events/Monat" },
          { icon: Sparkles, label: "Verfügbarkeit", value: "99,993 % in den letzten 90 Tagen" },
        ].map((row) => (
          <li key={row.label} className="flex items-center gap-3 text-xs">
            <row.icon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ml-auto text-right font-medium">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
