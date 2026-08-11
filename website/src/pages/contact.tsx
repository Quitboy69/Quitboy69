import { useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Mail, MapPin, Phone, Send } from "lucide-react";
import { AuroraBackground } from "@/components/aurora-background";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/use-page-meta";
import { revealDelay } from "@/hooks/use-reveal";
import { site } from "@/data/site";
import { cn } from "@/lib/utils";

interface FormValues {
  name: string;
  email: string;
  company: string;
  topic: string;
  message: string;
}

type Errors = Partial<Record<keyof FormValues, string>>;

const emptyForm: FormValues = { name: "", email: "", company: "", topic: "demo", message: "" };

const topics = [
  { value: "demo", label: "Demo vereinbaren" },
  { value: "preise", label: "Frage zu den Preisen" },
  { value: "technik", label: "Technische Frage" },
  { value: "sonstiges", label: "Etwas anderes" },
];

function validate(values: FormValues): Errors {
  const errors: Errors = {};
  if (values.name.trim().length < 2) errors.name = "Bitte gib deinen Namen an.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email))
    errors.email = "Diese E-Mail-Adresse sieht nicht gültig aus.";
  if (values.message.trim().length < 10)
    errors.message = "Ein paar Worte mehr helfen uns bei der Antwort (mind. 10 Zeichen).";
  return errors;
}

const fieldClass =
  "w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50";

export default function Contact() {
  usePageMeta({
    title: `Kontakt — ${site.name}`,
    description:
      "Demo vereinbaren oder eine Frage stellen. Es antwortet jemand aus dem Team, meist innerhalb eines Werktags.",
  });

  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  const update = (field: keyof FormValues) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      // Fokus auf das erste fehlerhafte Feld setzen.
      const firstField = Object.keys(nextErrors)[0];
      document.getElementById(firstField)?.focus();
      return;
    }

    setState("sending");
    // Demo-Versand. Hier später den echten Endpunkt oder eine Edge Function aufrufen.
    window.setTimeout(() => {
      setState("sent");
      setValues(emptyForm);
    }, 900);
  };

  return (
    <section className="relative overflow-hidden pb-24 pt-32 sm:pt-40">
      <AuroraBackground intensity="soft" />

      <div className="container relative">
        <div className="mx-auto max-w-2xl text-center">
          <div data-reveal>
            <Badge variant="primary">Kontakt</Badge>
          </div>
          <h1
            data-reveal
            style={revealDelay(1)}
            className="mt-6 text-balance font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-display-sm"
          >
            Sprechen wir über euer Produkt
          </h1>
          <p
            data-reveal
            style={revealDelay(2)}
            className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground"
          >
            Ob 30-minütige Demo oder eine kurze technische Rückfrage — wir melden uns in der Regel
            innerhalb eines Werktags.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.4fr]">
          {/* Kontaktdaten */}
          <div data-reveal className="flex flex-col gap-4">
            {[
              { icon: Mail, label: "E-Mail", value: site.email, href: `mailto:${site.email}` },
              {
                icon: Phone,
                label: "Telefon",
                value: site.phone,
                href: `tel:${site.phone.replace(/\s/g, "")}`,
              },
              { icon: MapPin, label: "Büro", value: site.address },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border bg-card p-5">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <item.icon className="size-4 text-primary" aria-hidden="true" />
                  {item.label}
                </span>
                <p className="mt-2 text-sm font-medium">
                  {item.href ? (
                    <a href={item.href} className="transition-colors hover:text-primary">
                      {item.value}
                    </a>
                  ) : (
                    item.value
                  )}
                </p>
              </div>
            ))}

            <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-5">
              <p className="text-sm font-medium">Lieber gleich ausprobieren?</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Der Starter-Tarif ist dauerhaft kostenlos und braucht keine Kreditkarte.
              </p>
            </div>
          </div>

          {/* Formular */}
          <div data-reveal style={revealDelay(1)}>
            {state === "sent" ? (
              <div
                role="status"
                className="flex h-full flex-col items-center justify-center rounded-3xl border bg-card p-10 text-center"
              >
                <CheckCircle2 className="size-12 text-primary" aria-hidden="true" />
                <h2 className="mt-5 font-display text-2xl font-bold tracking-tight">
                  Nachricht ist raus
                </h2>
                <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
                  Danke! Wir haben deine Anfrage erhalten und melden uns in der Regel innerhalb
                  eines Werktags.
                </p>
                <Button variant="secondary" className="mt-6" onClick={() => setState("idle")}>
                  Weitere Nachricht schreiben
                </Button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                noValidate
                className="rounded-3xl border bg-card p-6 sm:p-8"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="text-sm font-medium">
                      Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="name"
                      name="name"
                      value={values.name}
                      onChange={update("name")}
                      placeholder="Alex Schneider"
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? "name-error" : undefined}
                      className={cn("mt-2", fieldClass, errors.name && "border-destructive")}
                    />
                    {errors.name && (
                      <p id="name-error" className="mt-1.5 text-xs text-destructive">
                        {errors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="email" className="text-sm font-medium">
                      E-Mail <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={values.email}
                      onChange={update("email")}
                      placeholder="alex@firma.de"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "email-error" : undefined}
                      className={cn("mt-2", fieldClass, errors.email && "border-destructive")}
                    />
                    {errors.email && (
                      <p id="email-error" className="mt-1.5 text-xs text-destructive">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="company" className="text-sm font-medium">
                      Unternehmen
                    </label>
                    <input
                      id="company"
                      name="company"
                      value={values.company}
                      onChange={update("company")}
                      placeholder="Northwind GmbH"
                      className={cn("mt-2", fieldClass)}
                    />
                  </div>

                  <div>
                    <label htmlFor="topic" className="text-sm font-medium">
                      Anliegen
                    </label>
                    {/* appearance-none entfernt den System-Pfeil,
                        deshalb zeichnen wir ihn selbst darüber */}
                    <div className="relative mt-2">
                      <select
                        id="topic"
                        name="topic"
                        value={values.topic}
                        onChange={update("topic")}
                        className={cn("appearance-none pr-11", fieldClass)}
                      >
                        {topics.map((topic) => (
                          <option key={topic.value} value={topic.value}>
                            {topic.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <label htmlFor="message" className="text-sm font-medium">
                    Nachricht <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    value={values.message}
                    onChange={update("message")}
                    placeholder="Erzähl kurz, woran ihr arbeitet und was ihr messen wollt."
                    aria-invalid={Boolean(errors.message)}
                    aria-describedby={errors.message ? "message-error" : undefined}
                    className={cn(
                      "mt-2 resize-y",
                      fieldClass,
                      errors.message && "border-destructive",
                    )}
                  />
                  {errors.message && (
                    <p id="message-error" className="mt-1.5 text-xs text-destructive">
                      {errors.message}
                    </p>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <Button type="submit" size="lg" variant="gradient" disabled={state === "sending"}>
                    {state === "sending" ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Wird gesendet
                      </>
                    ) : (
                      <>
                        <Send />
                        Nachricht senden
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Mit dem Absenden stimmst du unserer Datenschutzerklärung zu.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
