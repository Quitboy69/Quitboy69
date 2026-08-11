import { MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Section, SectionHeader } from "@/components/ui/section";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { faqs } from "@/data/site";

export function Faq() {
  return (
    <Section className="border-t bg-secondary/20">
      <div className="container grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeader
            align="left"
            eyebrow="Häufige Fragen"
            title="Das Wichtigste vorab geklärt"
            description="Und falls doch etwas offenbleibt: Es antwortet jemand aus dem Team, kein Chatbot."
          />
          <div data-reveal className="mt-8">
            <Link to="/kontakt">
              <Button variant="secondary" size="lg">
                <MessageCircle />
                Frage stellen
              </Button>
            </Link>
          </div>
        </div>

        <div data-reveal>
          <Accordion items={faqs} />
        </div>
      </div>
    </Section>
  );
}
