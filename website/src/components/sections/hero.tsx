import { Link } from "react-router-dom";
import { ArrowRight, PlayCircle, Sparkles, Star } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { DashboardMockup } from "@/components/dashboard-mockup";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { heroStats } from "@/data/site";
import { revealDelay } from "@/hooks/use-reveal";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-28 sm:pb-28 sm:pt-36">
      <AuroraBackground />

      <div className="container relative">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <div data-reveal>
            <Badge variant="glass" className="gap-2 py-1.5 pl-1.5 pr-3.5">
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                Neu
              </span>
              <span className="text-muted-foreground">KI-Insights sind live</span>
              <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </Badge>
          </div>

          <h1
            data-reveal
            style={revealDelay(1)}
            className="mt-7 text-balance font-display text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-5xl lg:text-display-md"
          >
            Produktdaten, die endlich <span className="text-gradient">Entscheidungen</span> auslösen
          </h1>

          <p
            data-reveal
            style={revealDelay(2)}
            className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl"
          >
            Echtzeit-Analytics, Session Replay und KI-Insights in einer Plattform. Eingerichtet in
            fünf Minuten, gehostet in der EU, verständlich für das ganze Team.
          </p>

          <div
            data-reveal
            style={revealDelay(3)}
            className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
          >
            <Link to="/preise" className="w-full sm:w-auto">
              <Button variant="gradient" size="lg" className="w-full sm:w-auto">
                Kostenlos starten
                <ArrowRight />
              </Button>
            </Link>
            <ButtonLink href="#produkt" variant="secondary" size="lg" className="w-full sm:w-auto">
              <PlayCircle />
              Zwei-Minuten-Tour
            </ButtonLink>
          </div>

          <div
            data-reveal
            style={revealDelay(4)}
            className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground"
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="flex" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="size-3.5 fill-amber-400 text-amber-400" />
                ))}
              </span>
              4,9 auf G2
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              Keine Kreditkarte nötig
            </span>
          </div>
        </div>

        {/* Produktvorschau */}
        <div
          data-reveal
          style={revealDelay(5)}
          className="relative mx-auto mt-16 max-w-5xl sm:mt-20"
          id="produkt"
        >
          {/* Lichtschein hinter dem Fenster */}
          <div
            aria-hidden="true"
            className="absolute -inset-x-8 -top-8 bottom-8 rounded-[3rem] bg-primary/20 blur-3xl"
          />
          <DashboardMockup className="relative" />
        </div>

        {/* Kennzahlen */}
        <dl className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-x-6 gap-y-8 sm:mt-20 lg:grid-cols-4">
          {heroStats.map((stat, index) => (
            <div
              key={stat.label}
              data-reveal
              style={revealDelay(index)}
              className="flex flex-col-reverse items-center gap-1 text-center"
            >
              <dt className="text-sm text-muted-foreground">{stat.label}</dt>
              <dd className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
