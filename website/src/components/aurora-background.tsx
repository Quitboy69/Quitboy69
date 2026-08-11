import { cn } from "@/lib/utils";

interface AuroraBackgroundProps {
  className?: string;
  /** Dezenter für Unterseiten, kräftig für den Hero. */
  intensity?: "soft" | "strong";
}

/**
 * Der Aurora-Verlauf hinter dem Hero: drei weich gezeichnete Farbwolken,
 * die langsam gegeneinander driften, plus ein Raster darüber.
 * Rein dekorativ, deshalb aria-hidden und pointer-events-none.
 */
export function AuroraBackground({ className, intensity = "strong" }: AuroraBackgroundProps) {
  const opacity = intensity === "strong" ? "opacity-70" : "opacity-40";

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {/* Farbwolken */}
      <div className={cn("absolute inset-0 blur-[100px]", opacity)}>
        <div
          className="absolute -left-[10%] -top-[20%] h-[38rem] w-[38rem] rounded-full animate-aurora"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--aurora-1) / 0.75), transparent 62%)",
          }}
        />
        <div
          className="absolute -right-[8%] -top-[10%] h-[34rem] w-[34rem] rounded-full animate-aurora [animation-delay:-6s]"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--aurora-2) / 0.55), transparent 62%)",
          }}
        />
        <div
          className="absolute left-[28%] top-[18%] h-[30rem] w-[30rem] rounded-full animate-aurora [animation-delay:-12s]"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--aurora-3) / 0.5), transparent 62%)",
          }}
        />
      </div>

      {/* Raster, das nach unten ausblendet */}
      <div className="absolute inset-0 bg-grid-light bg-[length:64px_64px] mask-fade-b opacity-25 dark:opacity-20" />

      {/* Weicher Übergang in den Seitenhintergrund */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
