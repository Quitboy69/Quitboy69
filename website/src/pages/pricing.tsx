import { AuroraBackground } from "@/components/aurora-background";
import { Badge } from "@/components/ui/badge";
import { Pricing } from "@/components/sections/pricing";
import { Faq } from "@/components/sections/faq";
import { Cta } from "@/components/sections/cta";
import { Section, SectionHeader } from "@/components/ui/section";
import { usePageMeta } from "@/hooks/use-page-meta";
import { revealDelay } from "@/hooks/use-reveal";
import { plans, site } from "@/data/site";
import { Check, Minus } from "lucide-react";

/* Vergleichsmatrix — bewusst kurz gehalten, sonst liest sie niemand. */
const comparison = [
  { feature: "Events pro Monat", values: ["50.000", "5 Mio.", "Unbegrenzt"] },
  { feature: "Dashboards", values: ["3", "Unbegrenzt", "Unbegrenzt"] },
  { feature: "Session Replay", values: [false, true, true] },
  { feature: "KI-Insights", values: [false, true, true] },
  { feature: "Datenhistorie", values: ["30 Tage", "12 Monate", "Frei wählbar"] },
  { feature: "SSO (SAML / SCIM)", values: [false, false, true] },
  { feature: "Self-Hosting", values: [false, false, true] },
  { feature: "Uptime-Zusage im Vertrag", values: [false, false, true] },
];

function ComparisonCell({ value }: { value: string | boolean }) {
  if (typeof value === "string") return <span className="text-sm">{value}</span>;
  return value ? (
    <Check className="mx-auto size-4 text-primary" strokeWidth={2.5} aria-label="enthalten" />
  ) : (
    <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="nicht enthalten" />
  );
}

export default function PricingPage() {
  usePageMeta({
    title: `Preise — ${site.name}`,
    description:
      "Transparente Tarife ab 0 €. Bezahlt wird nach Events, nicht nach Nutzerkonten. Jährlich 20 % günstiger.",
  });

  return (
    <>
      <section className="relative overflow-hidden pb-8 pt-32 sm:pt-40">
        <AuroraBackground intensity="soft" />
        <div className="container relative mx-auto max-w-3xl text-center">
          <div data-reveal>
            <Badge variant="primary">Preise</Badge>
          </div>
          <h1
            data-reveal
            style={revealDelay(1)}
            className="mt-6 text-balance font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-display-sm md:text-display-md"
          >
            Preise, die mitwachsen — nicht überraschen
          </h1>
          <p
            data-reveal
            style={revealDelay(2)}
            className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground"
          >
            Unbegrenzte Nutzerkonten in jedem Tarif. Ihr zahlt für Events, nicht dafür, dass eine
            weitere Kollegin mitschaut.
          </p>
        </div>
      </section>

      <Pricing showHeader={false} />

      {/* Detailvergleich */}
      <Section className="border-t bg-secondary/20 pt-20">
        <div className="container">
          <SectionHeader
            eyebrow="Im Detail"
            title="Was in welchem Tarif steckt"
            description="Die vollständige Übersicht, damit vor dem Kauf keine Frage offenbleibt."
          />

          <div data-reveal className="mx-auto mt-12 max-w-4xl overflow-x-auto">
            <table className="w-full min-w-[36rem] border-separate border-spacing-0 overflow-hidden rounded-2xl border bg-card">
              <caption className="sr-only">Funktionsvergleich der Aurora-Tarife</caption>
              <thead>
                <tr>
                  <th scope="col" className="border-b p-4 text-left text-sm font-semibold">
                    Funktion
                  </th>
                  {plans.map((plan) => (
                    <th
                      key={plan.name}
                      scope="col"
                      className="border-b p-4 text-center text-sm font-semibold"
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, index) => (
                  <tr key={row.feature} className={index % 2 === 1 ? "bg-secondary/30" : undefined}>
                    <th
                      scope="row"
                      className="p-4 text-left text-sm font-normal text-muted-foreground"
                    >
                      {row.feature}
                    </th>
                    {row.values.map((value, cellIndex) => (
                      <td key={cellIndex} className="p-4 text-center">
                        <ComparisonCell value={value} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Faq />
      <Cta />
    </>
  );
}
