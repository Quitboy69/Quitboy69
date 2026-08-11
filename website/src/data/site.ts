import {
  Activity,
  BarChart3,
  Bell,
  Blocks,
  Bot,
  Fingerprint,
  Gauge,
  GitBranch,
  Globe2,
  LineChart,
  Lock,
  MousePointerClick,
  PlayCircle,
  ShieldCheck,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Zentrale Inhalte der Website.
 * Wer das Template kauft, ändert praktisch nur diese Datei —
 * die Komponenten lesen alles hier heraus.
 */

export const site = {
  name: "Aurora",
  tagline: "Analytics für moderne Produktteams",
  description:
    "Aurora verwandelt Produktdaten in Entscheidungen — Echtzeit-Analytics, Session Replay und KI-Insights in einer Plattform.",
  email: "hallo@aurora.dev",
  phone: "+49 30 5555 0142",
  address: "Torstraße 142, 10119 Berlin",
};

export const navLinks = [
  { label: "Funktionen", href: "/funktionen" },
  { label: "Preise", href: "/preise" },
  { label: "Kunden", href: "/#kunden" },
  { label: "Kontakt", href: "/kontakt" },
];

/* ---------------------------------- Hero --------------------------------- */

export const heroStats = [
  { value: "4.200+", label: "Produktteams" },
  { value: "38 Mrd.", label: "Events pro Monat" },
  { value: "99,99 %", label: "Uptime im Jahresmittel" },
  { value: "< 40 ms", label: "Query-Latenz p95" },
];

/* --------------------------------- Logos --------------------------------- */

export const trustedBy = [
  "Northwind",
  "Lumen",
  "Halcyon",
  "Vertex",
  "Kestrel",
  "Monolith",
  "Arcadia",
  "Beacon",
];

/* ------------------------------- Bento-Grid ------------------------------- */

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const bentoFeatures: Feature[] = [
  {
    icon: LineChart,
    title: "Echtzeit-Dashboards",
    description:
      "Events erscheinen in unter einer Sekunde. Kein nächtlicher Batch-Job, keine veralteten Zahlen im Standup.",
  },
  {
    icon: Bot,
    title: "KI-Insights",
    description:
      "Aurora erkennt Anomalien selbst und erklärt in einem Satz, welche Kohorte dahintersteckt.",
  },
  {
    icon: PlayCircle,
    title: "Session Replay",
    description:
      "Sieh die Aufzeichnung genau der Sitzung, in der ein Nutzer abgesprungen ist — DSGVO-konform maskiert.",
  },
  {
    icon: Workflow,
    title: "Funnels & Kohorten",
    description:
      "Trichter per Drag-and-drop bauen und nach jedem beliebigen Attribut aufschlüsseln.",
  },
  {
    icon: Bell,
    title: "Smarte Alerts",
    description:
      "Schwellwerte lernen aus der Historie und melden sich in Slack, bevor der Kunde es merkt.",
  },
  {
    icon: Blocks,
    title: "SQL wenn du willst",
    description:
      "Jedes Diagramm lässt sich in SQL öffnen, anpassen und als eigene Kachel zurückspeichern.",
  },
];

/* ----------------------------- Feature-Sektion ---------------------------- */

export const featureHighlights = [
  {
    id: "insights",
    eyebrow: "Analyse",
    title: "Von der Frage zur Antwort in 30 Sekunden",
    description:
      "Stell deine Frage in normaler Sprache. Aurora übersetzt sie in eine Abfrage, zeigt das Ergebnis und legt den generierten SQL offen — nachvollziehbar statt Blackbox.",
    bullets: [
      "Natürliche Sprache zu SQL, immer einsehbar",
      "Automatische Aufschlüsselung nach auffälligen Segmenten",
      "Jede Antwort mit einem Klick als Dashboard-Kachel speichern",
    ],
    icon: BarChart3,
  },
  {
    id: "replay",
    eyebrow: "Verstehen",
    title: "Zahlen sagen was. Replays sagen warum.",
    description:
      "Springe von jedem Knick in der Kurve direkt in die Aufzeichnungen dahinter. Eingaben in Formularen werden clientseitig maskiert, bevor sie den Browser verlassen.",
    bullets: [
      "Sprung vom Chart-Datenpunkt in die passende Session",
      "Rage-Clicks, tote Klicks und Fehler automatisch markiert",
      "Maskierung standardmäßig an, konfigurierbar per Selektor",
    ],
    icon: MousePointerClick,
  },
  {
    id: "scale",
    eyebrow: "Technik",
    title: "Gebaut für Milliarden Events",
    description:
      "Eine spaltenorientierte Engine, die auch bei 38 Milliarden Events im Monat interaktiv bleibt. Gehostet in Frankfurt, wahlweise als eigene Instanz.",
    bullets: [
      "p95-Query-Latenz unter 40 ms",
      "EU-Hosting, SOC-2-Typ-II und ISO 27001",
      "Self-Hosting per Helm-Chart für regulierte Branchen",
    ],
    icon: Gauge,
  },
];

/* -------------------------------- Workflow -------------------------------- */

export const steps = [
  {
    number: "01",
    title: "Verbinden",
    description:
      "SDK einbinden oder eine der 60 Datenquellen verknüpfen. Die erste Auswertung steht nach rund fünf Minuten.",
    icon: GitBranch,
  },
  {
    number: "02",
    title: "Verstehen",
    description:
      "Aurora legt Standard-Dashboards für Aktivierung, Bindung und Umsatz automatisch an.",
    icon: Activity,
  },
  {
    number: "03",
    title: "Handeln",
    description:
      "Alerts, geteilte Ansichten und Exporte bringen die Erkenntnis dorthin, wo entschieden wird.",
    icon: Zap,
  },
];

/* -------------------------------- Metriken -------------------------------- */

export const metrics = [
  { value: "31 %", label: "mehr abgeschlossene Onboardings", sub: "Median über 120 Teams" },
  { value: "6,5 h", label: "gesparte Reporting-Zeit pro Woche", sub: "pro Produktmanager:in" },
  { value: "4,9/5", label: "Bewertung auf G2", sub: "aus 812 Bewertungen" },
];

/* ------------------------------ Testimonials ------------------------------ */

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
  initials: string;
}

export const testimonials: Testimonial[] = [
  {
    quote:
      "Wir haben drei Tools durch Aurora ersetzt. Die Diskussion im Team dreht sich endlich um Entscheidungen statt darum, welcher Zahl man glaubt.",
    name: "Marlene Fuchs",
    role: "VP Product",
    company: "Northwind",
    initials: "MF",
  },
  {
    quote:
      "Der Sprung vom Chart direkt ins Session Replay hat unsere Ursachensuche von Tagen auf Minuten verkürzt. Das klingt übertrieben, ist aber gemessen.",
    name: "Tobias Reinhardt",
    role: "Head of Growth",
    company: "Lumen",
    initials: "TR",
  },
  {
    quote:
      "Unsere Datenabteilung war skeptisch, bis sie den generierten SQL gesehen hat. Sauber, lesbar, überprüfbar. Jetzt bauen sie selbst darauf auf.",
    name: "Ayşe Demir",
    role: "Director of Data",
    company: "Halcyon",
    initials: "AD",
  },
  {
    quote:
      "Onboarding an einem Vormittag, erste echte Erkenntnis am Nachmittag. So etwas habe ich in fünfzehn Jahren nicht erlebt.",
    name: "Jonas Weber",
    role: "CTO",
    company: "Vertex",
    initials: "JW",
  },
  {
    quote:
      "Die Anomalie-Alerts haben einen kaputten Checkout gemeldet, bevor der erste Kunde geschrieben hat. Das hat sich am selben Tag bezahlt gemacht.",
    name: "Clara Neumann",
    role: "Lead Engineer",
    company: "Kestrel",
    initials: "CN",
  },
  {
    quote:
      "EU-Hosting und ein Auftragsverarbeitungsvertrag ohne Rückfragen — für unseren Datenschutzbeauftragten war das der Ausschlag.",
    name: "Philipp Braun",
    role: "COO",
    company: "Monolith",
    initials: "PB",
  },
];

/* --------------------------------- Preise --------------------------------- */

export interface Plan {
  name: string;
  monthly: number;
  yearly: number;
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
}

export const plans: Plan[] = [
  {
    name: "Starter",
    monthly: 0,
    yearly: 0,
    description: "Für Solo-Gründer und erste Prototypen.",
    features: [
      "50.000 Events pro Monat",
      "3 Dashboards",
      "30 Tage Datenhistorie",
      "Community-Support",
    ],
    cta: "Kostenlos starten",
  },
  {
    name: "Growth",
    monthly: 79,
    yearly: 63,
    description: "Für Produktteams, die wöchentlich ausliefern.",
    features: [
      "5 Mio. Events pro Monat",
      "Unbegrenzte Dashboards",
      "Session Replay inklusive",
      "KI-Insights und Anomalie-Alerts",
      "12 Monate Historie",
      "Support-Antwort in unter 4 Stunden",
    ],
    cta: "14 Tage testen",
    featured: true,
  },
  {
    name: "Enterprise",
    monthly: 249,
    yearly: 199,
    description: "Für regulierte Branchen und große Organisationen.",
    features: [
      "Unbegrenzte Events",
      "Self-Hosting oder dedizierte EU-Instanz",
      "SSO über SAML und SCIM",
      "Individuelle Datenhaltungsfristen",
      "99,99 % Uptime-Zusage im Vertrag",
      "Fester Ansprechpartner",
    ],
    cta: "Demo vereinbaren",
  },
];

/* ---------------------------------- FAQ ----------------------------------- */

export const faqs = [
  {
    question: "Wie lange dauert die Einrichtung wirklich?",
    answer:
      "Das Web-SDK ist ein Snippet und in wenigen Minuten eingebunden. Für React, Vue, Svelte, iOS, Android und Node gibt es fertige Pakete. Die Standard-Dashboards legt Aurora automatisch an, sobald die ersten Events ankommen.",
  },
  {
    question: "Wo liegen unsere Daten?",
    answer:
      "Standardmäßig in Frankfurt am Main. Auf Wunsch auch in einer dedizierten Instanz oder komplett selbst gehostet per Helm-Chart. Einen Auftragsverarbeitungsvertrag stellen wir für alle Tarife bereit, auch den kostenlosen.",
  },
  {
    question: "Können wir von unserem bisherigen Tool migrieren?",
    answer:
      "Ja. Für Mixpanel, Amplitude, Heap und Google Analytics 4 gibt es Importer, die historische Events samt Nutzerprofilen übernehmen. Bei mehr als 100 Millionen Events begleitet unser Team die Migration kostenlos.",
  },
  {
    question: "Was passiert, wenn wir das Event-Kontingent überschreiten?",
    answer:
      "Nichts bricht ab. Wir erfassen weiter, melden uns bei 80 Prozent des Kontingents und rechnen den Überhang zum jeweiligen Staffelpreis ab. Eine Deckelung kannst du in den Einstellungen aktivieren.",
  },
  {
    question: "Ist Session Replay mit der DSGVO vereinbar?",
    answer:
      "Ja, bei korrekter Konfiguration. Eingaben werden bereits im Browser maskiert, bevor irgendetwas übertragen wird. Zusätzliche Selektoren lassen sich ausschließen, und Aufzeichnungen können nach einer selbst gewählten Frist automatisch gelöscht werden.",
  },
  {
    question: "Gibt es Rabatte für Startups oder gemeinnützige Organisationen?",
    answer:
      "Startups unter zwei Jahren erhalten zwölf Monate zum halben Preis, gemeinnützige Organisationen und Open-Source-Projekte nutzen Growth dauerhaft kostenlos. Eine kurze Mail an hallo@aurora.dev genügt.",
  },
];

/* ------------------------------ Integrationen ----------------------------- */

export const integrations = [
  { name: "Slack", icon: Bell },
  { name: "GitHub", icon: GitBranch },
  { name: "Segment", icon: Blocks },
  { name: "Snowflake", icon: Globe2 },
  { name: "Stripe", icon: Zap },
  { name: "HubSpot", icon: Users },
];

/* -------------------------------- Sicherheit ------------------------------ */

export const securityBadges = [
  { icon: ShieldCheck, label: "SOC 2 Typ II" },
  { icon: Lock, label: "ISO 27001" },
  { icon: Globe2, label: "EU-Hosting" },
  { icon: Fingerprint, label: "DSGVO-konform" },
];

/* --------------------------------- Footer --------------------------------- */

export const footerColumns = [
  {
    title: "Produkt",
    links: [
      { label: "Funktionen", href: "/funktionen" },
      { label: "Preise", href: "/preise" },
      { label: "Integrationen", href: "/funktionen#integrationen" },
      { label: "Changelog", href: "/funktionen" },
    ],
  },
  {
    title: "Unternehmen",
    links: [
      { label: "Über uns", href: "/kontakt" },
      { label: "Karriere", href: "/kontakt" },
      { label: "Kontakt", href: "/kontakt" },
      { label: "Presse", href: "/kontakt" },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { label: "Impressum", href: "/kontakt" },
      { label: "Datenschutz", href: "/kontakt" },
      { label: "AGB", href: "/kontakt" },
      { label: "Auftragsverarbeitung", href: "/kontakt" },
    ],
  },
];
