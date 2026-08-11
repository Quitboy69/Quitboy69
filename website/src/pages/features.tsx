import { AuroraBackground } from "@/components/aurora-background";
import { Badge } from "@/components/ui/badge";
import { BentoFeatures } from "@/components/sections/bento-features";
import { FeatureHighlights } from "@/components/sections/feature-highlights";
import { Integrations } from "@/components/sections/integrations";
import { Workflow } from "@/components/sections/workflow";
import { Cta } from "@/components/sections/cta";
import { usePageMeta } from "@/hooks/use-page-meta";
import { revealDelay } from "@/hooks/use-reveal";
import { site } from "@/data/site";

export default function Features() {
  usePageMeta({
    title: `Funktionen — ${site.name}`,
    description:
      "Echtzeit-Dashboards, Session Replay, KI-Insights, Funnels und über 60 Integrationen. Alle Funktionen von Aurora im Überblick.",
  });

  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-32 sm:pt-40">
        <AuroraBackground intensity="soft" />
        <div className="container relative mx-auto max-w-3xl text-center">
          <div data-reveal>
            <Badge variant="primary">Funktionen</Badge>
          </div>
          <h1
            data-reveal
            style={revealDelay(1)}
            className="mt-6 text-balance font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-display-sm md:text-display-md"
          >
            Eine Plattform statt fünf Abonnements
          </h1>
          <p
            data-reveal
            style={revealDelay(2)}
            className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground"
          >
            Alles, was ein Produktteam braucht, um zu verstehen, was Nutzer tun — und warum sie es
            tun. Auf einer gemeinsamen Datenbasis, ohne Abgleich zwischen Tools.
          </p>
        </div>
      </section>

      <BentoFeatures />
      <FeatureHighlights />
      <Workflow />
      <Integrations />
      <Cta />
    </>
  );
}
