import { useEffect, type CSSProperties } from "react";

const REVEALED = "visible";

/**
 * Blendet alle Elemente mit `data-reveal` beim Scrollen ein.
 * Ein einziger Observer für die ganze Seite — deutlich günstiger als
 * ein Observer pro Komponente. Läuft nach jedem Routenwechsel neu.
 *
 * Zusätzlich läuft ein Nachzügler-Durchlauf beim Scrollen: der
 * IntersectionObserver fasst seine Meldungen zusammen und kann bei sehr
 * schnellem Scrollen einzelne Elemente überspringen. Ohne diese Absicherung
 * blieben sie dauerhaft unsichtbar — Inhalt darf aber nie verloren gehen.
 */
export function useReveal(dependency?: unknown) {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (elements.length === 0) return;

    const reveal = (element: HTMLElement) => element.setAttribute("data-reveal", REVEALED);
    const isPending = (element: HTMLElement) =>
      element.getAttribute("data-reveal") !== REVEALED;

    // Ohne IntersectionObserver (oder bei reduzierter Bewegung) alles sofort zeigen.
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      elements.forEach(reveal);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          reveal(entry.target as HTMLElement);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    elements.forEach((element) => observer.observe(element));

    // Sicherheitsnetz: alles einblenden, was bereits oberhalb der
    // Viewport-Unterkante liegt, aber vom Observer nicht gemeldet wurde.
    let frame = 0;
    const sweep = () => {
      frame = 0;
      const limit = window.innerHeight;
      let pending = 0;
      elements.forEach((element) => {
        if (!isPending(element)) return;
        if (element.getBoundingClientRect().top < limit) {
          reveal(element);
          observer.unobserve(element);
        } else {
          pending += 1;
        }
      });
      // Nichts mehr offen? Dann brauchen wir den Listener nicht länger.
      if (pending === 0) window.removeEventListener("scroll", onScroll);
    };

    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(sweep);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [dependency]);
}

/** Hilfsfunktion für gestaffelte Reveal-Verzögerungen. */
export function revealDelay(index: number, step = 70) {
  return { "--reveal-delay": `${index * step}ms` } as CSSProperties;
}
