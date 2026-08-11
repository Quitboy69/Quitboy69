import { Section, SectionHeader } from "@/components/ui/section";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { bentoFeatures } from "@/data/site";
import { revealDelay } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

/*
  Bento-Rhythmus über drei Reihen:
  2+1 · 1+1+1 · 3 — die letzte Kachel läuft über die volle Breite,
  sonst bliebe rechts unten ein Loch im Raster.
*/
const spans = [
  "md:col-span-2",
  "md:col-span-1",
  "md:col-span-1",
  "md:col-span-1",
  "md:col-span-1",
  "md:col-span-3",
];

export function BentoFeatures() {
  return (
    <Section id="funktionen">
      <div className="container">
        <SectionHeader
          eyebrow="Alles an einem Ort"
          title="Sechs Werkzeuge, die sonst sechs Rechnungen wären"
          description="Aurora bündelt, wofür Teams üblicherweise mehrere Tools verbinden — und hält dabei eine einzige Datenbasis."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {bentoFeatures.map((feature, index) => {
            // Die vollbreite Kachel legt Symbol und Text nebeneinander,
            // sonst wirkt sie oben und unten leer.
            const isWide = spans[index] === "md:col-span-3";

            return (
              <SpotlightCard
                key={feature.title}
                data-reveal
                style={revealDelay(index % 3)}
                className={cn(
                  "group p-6 hover:border-primary/30 hover:shadow-card sm:p-7",
                  spans[index],
                )}
              >
                <div
                  className={cn(
                    "relative z-10 flex h-full flex-col",
                    isWide && "md:flex-row md:items-center md:gap-7",
                  )}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-transform duration-300 group-hover:-translate-y-0.5">
                    <feature.icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className={cn(isWide && "md:flex-1")}>
                    <h3
                      className={cn(
                        "mt-5 font-display text-lg font-semibold tracking-tight",
                        isWide && "md:mt-0",
                      )}
                    >
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
