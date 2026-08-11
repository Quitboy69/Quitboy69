import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccordionItem {
  question: string;
  answer: string;
}

interface AccordionProps {
  items: AccordionItem[];
  /** Index, der beim ersten Rendern offen ist. `null` = alles zu. */
  defaultOpen?: number | null;
  className?: string;
}

/**
 * Barrierefreies Accordion ohne externe Abhängigkeit.
 * Die Höhenanimation läuft über `grid-template-rows: 0fr -> 1fr`,
 * damit beliebig lange Antworten sauber auf- und zuklappen.
 */
export function Accordion({ items, defaultOpen = 0, className }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpen);
  const baseId = useId();

  return (
    <div className={cn("divide-y divide-border overflow-hidden rounded-2xl border bg-card", className)}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;

        return (
          <div key={item.question}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-6 px-5 py-5 text-left transition-colors hover:bg-secondary/50 sm:px-7 sm:py-6"
              >
                <span className="font-display text-base font-semibold sm:text-lg">
                  {item.question}
                </span>
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border bg-background transition-all duration-300",
                    isOpen && "rotate-45 border-primary/40 bg-primary/10 text-primary",
                  )}
                >
                  <Plus className="size-4" aria-hidden="true" />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-6 pr-14 text-pretty leading-relaxed text-muted-foreground sm:px-7">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
