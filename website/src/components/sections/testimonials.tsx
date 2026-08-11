import { Quote } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { metrics, testimonials } from "@/data/site";
import { revealDelay } from "@/hooks/use-reveal";

export function Testimonials() {
  return (
    <Section id="kunden" className="scroll-mt-20 border-t bg-secondary/20">
      <div className="container">
        <SectionHeader
          eyebrow="Kundenstimmen"
          title="Was Teams nach dem Wechsel berichten"
          description="Ausgewählte Rückmeldungen aus Produkt, Wachstum und Technik — gekürzt, aber nicht geschönt."
        />

        {/* Harte Zahlen über den Zitaten */}
        <dl className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-3">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              data-reveal
              style={revealDelay(index)}
              /* justify-end schiebt den Inhalt bei column-reverse nach oben,
                 damit die Zahlen aller drei Karten auf einer Linie liegen */
              className="flex flex-col-reverse justify-end rounded-2xl border bg-card p-6 text-center"
            >
              {/* dt steht im DOM zuerst, wird per flex-col-reverse aber unten gezeigt */}
              <dt className="mt-2 text-sm font-medium">
                {metric.label}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {metric.sub}
                </span>
              </dt>
              <dd className="font-display text-3xl font-bold tracking-tight text-gradient">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* Zitate im Masonry-Fluss */}
        <div className="mt-8 columns-1 gap-4 md:columns-2 lg:columns-3">
          {testimonials.map((testimonial, index) => (
            <SpotlightCard
              key={testimonial.name}
              data-reveal
              style={revealDelay(index % 3)}
              className="mb-4 break-inside-avoid p-6 hover:border-primary/30"
            >
              <Quote className="size-5 text-primary/60" aria-hidden="true" />
              <blockquote className="relative z-10 mt-4 text-pretty text-sm leading-relaxed">
                {testimonial.quote}
              </blockquote>
              <div className="relative z-10 mt-5 flex items-center gap-3 border-t pt-4">
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground"
                >
                  {testimonial.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{testimonial.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {testimonial.role} · {testimonial.company}
                  </span>
                </span>
              </div>
            </SpotlightCard>
          ))}
        </div>
      </div>
    </Section>
  );
}
