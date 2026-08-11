import { Section, SectionHeader } from "@/components/ui/section";
import { steps } from "@/data/site";
import { revealDelay } from "@/hooks/use-reveal";

export function Workflow() {
  return (
    <Section>
      <div className="container">
        <SectionHeader
          eyebrow="So läuft es ab"
          title="Drei Schritte bis zur ersten Erkenntnis"
          description="Kein Onboarding-Projekt, kein Data-Engineering-Ticket. Einbinden, ansehen, handeln."
        />

        <ol className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
          {/* Verbindungslinie zwischen den Schritten */}
          <div
            aria-hidden="true"
            className="absolute inset-x-[16%] top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
          />

          {steps.map((step, index) => (
            <li
              key={step.number}
              data-reveal
              style={revealDelay(index, 110)}
              className="relative flex flex-col items-center text-center"
            >
              <span className="relative grid size-14 place-items-center rounded-2xl border border-primary/25 bg-background text-primary shadow-glow">
                <step.icon className="size-6" aria-hidden="true" />
              </span>
              <span className="mt-5 font-mono text-xs font-medium tracking-widest text-primary">
                {step.number}
              </span>
              <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">
                {step.title}
              </h3>
              <p className="mt-2.5 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
