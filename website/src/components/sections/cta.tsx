import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { AuroraBackground } from "@/components/aurora-background";

export function Cta() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="container">
        <div className="relative overflow-hidden rounded-[2rem] border bg-card px-6 py-16 text-center sm:px-12 sm:py-20">
          <AuroraBackground intensity="soft" />

          <div className="relative mx-auto max-w-2xl">
            <h2
              data-reveal
              className="text-balance font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl"
            >
              In fünf Minuten seht ihr eure ersten <span className="text-gradient">echten</span>{" "}
              Zahlen
            </h2>
            <p
              data-reveal
              style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
              className="mx-auto mt-5 max-w-xl text-pretty leading-relaxed text-muted-foreground sm:text-lg"
            >
              Kostenlos starten, ohne Kreditkarte. Oder erst in Ruhe zeigen lassen, wie andere Teams
              Aurora einsetzen.
            </p>

            <div
              data-reveal
              style={{ "--reveal-delay": "160ms" } as React.CSSProperties}
              className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Link to="/preise" className="w-full sm:w-auto">
                <Button variant="gradient" size="lg" className="w-full sm:w-auto">
                  Kostenlos starten
                  <ArrowRight />
                </Button>
              </Link>
              <Link to="/kontakt" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  <CalendarDays />
                  Demo vereinbaren
                </Button>
              </Link>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Fragen? Schreib uns an{" "}
              <ButtonLink
                href="mailto:hallo@aurora.dev"
                variant="ghost"
                size="sm"
                className="h-auto px-1 py-0 text-xs text-primary underline-offset-4 hover:bg-transparent hover:underline"
              >
                hallo@aurora.dev
              </ButtonLink>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
