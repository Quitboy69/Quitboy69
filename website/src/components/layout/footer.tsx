import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Github, Linkedin, Twitter } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { footerColumns, securityBadges, site } from "@/data/site";
import { cn } from "@/lib/utils";

const socials = [
  { label: "Twitter", icon: Twitter, href: "#twitter" },
  { label: "GitHub", icon: Github, href: "#github" },
  { label: "LinkedIn", icon: Linkedin, href: "#linkedin" },
];

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Demo-Formular: hier später den echten Endpunkt aufrufen.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setStatus("error");
      return;
    }
    setStatus("done");
    setEmail("");
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 w-full max-w-sm">
      <label htmlFor="newsletter-email" className="text-sm font-medium">
        Produkt-Updates, einmal im Monat
      </label>
      <div className="mt-2.5 flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          placeholder="du@firma.de"
          aria-invalid={status === "error"}
          aria-describedby="newsletter-hint"
          className={cn(
            "h-11 w-full rounded-full border bg-background px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50",
            status === "error" && "border-destructive",
          )}
        />
        <Button type="submit" size="icon" aria-label="Newsletter abonnieren">
          {status === "done" ? <Check /> : <ArrowRight />}
        </Button>
      </div>
      <p
        id="newsletter-hint"
        role="status"
        className={cn(
          "mt-2 text-xs",
          status === "error" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {status === "error" && "Bitte gib eine gültige E-Mail-Adresse ein."}
        {status === "done" && "Danke! Bitte bestätige die Anmeldung in deinem Postfach."}
        {status === "idle" && "Kein Spam. Abmeldung mit einem Klick."}
      </p>
    </form>
  );
}

export function Footer() {
  return (
    <footer className="relative border-t bg-secondary/30">
      <div className="container py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
              {site.description}
            </p>
            <NewsletterForm />
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h3 className="font-display text-sm font-semibold">{column.title}</h3>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-8">
          {securityBadges.map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-2 text-xs text-muted-foreground"
            >
              <badge.icon className="size-4 text-primary" aria-hidden="true" />
              {badge.label}
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-col-reverse items-start justify-between gap-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {site.name} Labs GmbH · {site.address}
          </p>
          <ul className="flex items-center gap-2">
            {socials.map((social) => (
              <li key={social.label}>
                <a
                  href={social.href}
                  aria-label={social.label}
                  className="grid size-9 place-items-center rounded-full border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <social.icon className="size-4" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
