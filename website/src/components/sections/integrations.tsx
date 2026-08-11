import { Plug } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { integrations, securityBadges } from "@/data/site";
import { revealDelay } from "@/hooks/use-reveal";

export function Integrations() {
  return (
    <Section id="integrationen" className="scroll-mt-20">
      <div className="container">
        <SectionHeader
          eyebrow="Integrationen"
          title="Passt zu dem, was ihr schon nutzt"
          description="Über 60 fertige Verbindungen — und eine offene API für alles andere."
        />

        <ul className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {integrations.map((integration, index) => (
            <li
              key={integration.name}
              data-reveal
              style={revealDelay(index, 60)}
              className="group flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-card"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-secondary text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                <integration.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium">{integration.name}</span>
            </li>
          ))}
        </ul>

        <div
          data-reveal
          className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-4 rounded-2xl border border-dashed p-6"
        >
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Plug className="size-4 text-primary" aria-hidden="true" />
            Alles andere über REST, Webhooks oder das SDK
          </span>
          {securityBadges.map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground"
            >
              <badge.icon className="size-4 text-primary" aria-hidden="true" />
              {badge.label}
            </span>
          ))}
        </div>
      </div>
    </Section>
  );
}
