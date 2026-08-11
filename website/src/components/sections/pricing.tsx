import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { plans } from "@/data/site";
import { revealDelay } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "yearly";

function BillingToggle({
  billing,
  onChange,
}: {
  billing: Billing;
  onChange: (value: Billing) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Abrechnungszeitraum"
      className="inline-flex items-center gap-1 rounded-full border bg-card p-1"
    >
      {(["monthly", "yearly"] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={billing === value}
          onClick={() => onChange(value)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
            billing === value
              ? "bg-primary text-primary-foreground shadow-glow"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {value === "monthly" ? "Monatlich" : "Jährlich"}
          {value === "yearly" && (
            <span
              className={cn(
                "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                billing === "yearly"
                  ? "bg-primary-foreground/20"
                  : "bg-accent/15 text-accent",
              )}
            >
              −20 %
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

interface PricingProps {
  /** Auf der Preisseite entfällt die einleitende Überschrift. */
  showHeader?: boolean;
}

export function Pricing({ showHeader = true }: PricingProps) {
  const [billing, setBilling] = useState<Billing>("yearly");

  return (
    <Section id="preise" className="scroll-mt-20">
      <div className="container">
        {showHeader && (
          <SectionHeader
            eyebrow="Preise"
            title="Ehrliche Preise, keine Verhandlungsspiele"
            description="Alle Tarife enthalten unbegrenzte Nutzerkonten. Bezahlt wird nach Events, nicht nach Sitzplätzen."
          />
        )}

        <div className="mt-10 flex justify-center" data-reveal>
          <BillingToggle billing={billing} onChange={setBilling} />
        </div>

        <div className="mt-12 grid items-start gap-6 lg:grid-cols-3">
          {plans.map((plan, index) => {
            const price = billing === "monthly" ? plan.monthly : plan.yearly;

            return (
              <div
                key={plan.name}
                data-reveal
                style={revealDelay(index)}
                className={cn(
                  "relative flex h-full flex-col rounded-3xl border bg-card p-7 transition-all duration-300 sm:p-8",
                  plan.featured
                    ? "border-primary/40 shadow-glow lg:-translate-y-4 lg:scale-[1.02]"
                    : "hover:border-primary/25 hover:shadow-card",
                )}
              >
                {plan.featured && (
                  <>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-primary/[0.07] to-transparent"
                    />
                    <Badge
                      variant="primary"
                      className="absolute -top-3 left-1/2 -translate-x-1/2 border-primary/40 bg-background"
                    >
                      <Sparkles className="size-3" aria-hidden="true" />
                      Am beliebtesten
                    </Badge>
                  </>
                )}

                <div className="relative">
                  <h3 className="font-display text-lg font-bold tracking-tight">{plan.name}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{plan.description}</p>

                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-extrabold tracking-tight">
                      {price === 0 ? "0 €" : `${price} €`}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {price === 0 ? "für immer" : "/ Monat"}
                    </span>
                  </p>
                  <p className="mt-1 h-5 text-xs text-muted-foreground">
                    {price > 0 && billing === "yearly" && "jährlich abgerechnet"}
                    {price > 0 && billing === "monthly" && "monatlich kündbar"}
                  </p>

                  <Button
                    variant={plan.featured ? "gradient" : "secondary"}
                    size="lg"
                    className="mt-6 w-full"
                  >
                    {plan.cta}
                  </Button>

                  <ul className="mt-7 space-y-3 border-t pt-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-primary"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                        <span className="text-pretty text-sm leading-relaxed text-muted-foreground">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground" data-reveal>
          Alle Preise zzgl. USt. · Startups und gemeinnützige Organisationen bekommen bis zu 100 %
          Rabatt.
        </p>
      </div>
    </Section>
  );
}
