import { trustedBy } from "@/data/site";

/**
 * Endlos laufendes Logo-Band. Die Liste steht zweimal im DOM und wandert
 * um genau 50 % — dadurch wirkt der Übergang nahtlos.
 * Das Duplikat ist aria-hidden, damit Screenreader nichts doppelt vorlesen.
 */
export function LogoMarquee() {
  return (
    <section className="border-y bg-secondary/25 py-10" aria-label="Kunden, die Aurora einsetzen">
      <div className="container">
        <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Im Einsatz bei über 4.200 Produktteams
        </p>

        <div className="group relative mt-7 overflow-hidden mask-fade-x">
          {/* Kein Abstand am Wrapper: die Liste trägt ihn selbst (gap + pr),
              damit -50 % exakt auf den Anfang der Kopie fällt. */}
          <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
            {[0, 1].map((copy) => (
              <ul
                key={copy}
                aria-hidden={copy === 1}
                className="flex shrink-0 items-center gap-14 pr-14"
              >
                {trustedBy.map((name) => (
                  <li
                    key={name}
                    className="whitespace-nowrap font-display text-xl font-bold tracking-tight text-muted-foreground/55 transition-colors duration-300 hover:text-foreground sm:text-2xl"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
