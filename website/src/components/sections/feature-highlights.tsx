import { Check } from "lucide-react";
import { Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { featureHighlights } from "@/data/site";
import { revealDelay } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";
import { InsightPanel, ReplayPanel, ScalePanel } from "@/components/feature-panels";

const panels = {
  insights: InsightPanel,
  replay: ReplayPanel,
  scale: ScalePanel,
} as const;

export function FeatureHighlights() {
  return (
    <Section className="overflow-hidden border-t bg-secondary/20">
      <div className="container flex flex-col gap-24 sm:gap-32">
        {featureHighlights.map((feature, index) => {
          const Panel = panels[feature.id as keyof typeof panels];
          const flipped = index % 2 === 1;

          return (
            <div
              key={feature.id}
              className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              {/* Text */}
              <div className={cn(flipped && "lg:order-2")}>
                <Badge variant="primary" data-reveal>
                  <feature.icon className="size-3.5" aria-hidden="true" />
                  {feature.eyebrow}
                </Badge>
                <h2
                  data-reveal
                  style={revealDelay(1)}
                  className="mt-5 text-balance font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
                >
                  {feature.title}
                </h2>
                <p
                  data-reveal
                  style={revealDelay(2)}
                  className="mt-4 text-pretty leading-relaxed text-muted-foreground sm:text-lg"
                >
                  {feature.description}
                </p>
                <ul className="mt-7 space-y-3.5">
                  {feature.bullets.map((bullet, bulletIndex) => (
                    <li
                      key={bullet}
                      data-reveal
                      style={revealDelay(bulletIndex + 3)}
                      className="flex items-start gap-3"
                    >
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                      </span>
                      <span className="text-pretty text-sm leading-relaxed sm:text-base">
                        {bullet}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visualisierung */}
              <div
                data-reveal
                style={revealDelay(2)}
                className={cn("relative", flipped && "lg:order-1")}
              >
                <div
                  aria-hidden="true"
                  className="absolute -inset-6 rounded-[2.5rem] bg-primary/10 blur-2xl"
                />
                <Panel className="relative" />
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
