import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/use-page-meta";
import { navLinks, site } from "@/data/site";

export default function NotFound() {
  const location = useLocation();

  usePageMeta({
    title: `Seite nicht gefunden — ${site.name}`,
    description: "Diese Seite existiert nicht. Hier geht es zurück zur Startseite.",
  });

  return (
    <section className="relative flex min-h-[80vh] items-center overflow-hidden py-32">
      <AuroraBackground intensity="soft" />

      <div className="container relative mx-auto max-w-xl text-center">
        <p className="font-display text-[7rem] font-extrabold leading-none tracking-tight text-gradient sm:text-[9rem]">
          404
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Diese Seite gibt es nicht
        </h1>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
          Der Pfad <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-sm">
            {location.pathname}
          </code>{" "}
          führt ins Leere. Vielleicht hilft einer dieser Wege weiter.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/">
            <Button variant="gradient" size="lg">
              <ArrowLeft />
              Zur Startseite
            </Button>
          </Link>
          <Link to="/funktionen">
            <Button variant="secondary" size="lg">
              <Compass />
              Funktionen ansehen
            </Button>
          </Link>
        </div>

        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                to={link.href}
                className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
