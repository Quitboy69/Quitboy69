# Aurora — Premium SaaS Landing Page Template

Ein verkaufsfertiges Website-Template im Lovable-Stack: **React 18 + TypeScript + Vite + Tailwind CSS**.
Vier fertige Seiten, Dark- und Light-Mode, Scroll-Animationen, komplett responsiv und ohne
schwere Abhängigkeiten.

![Aurora](public/og-image.svg)

---

## Was drin ist

| Seite | Pfad | Inhalt |
|-------|------|--------|
| Startseite | `/` | Hero mit animiertem Dashboard, Logo-Band, Bento-Grid, drei Feature-Sektionen, Ablauf, Kundenstimmen, Preise, FAQ, CTA |
| Funktionen | `/funktionen` | Bento-Grid, Feature-Sektionen, Ablauf, Integrationen |
| Preise | `/preise` | Tarifkarten mit Monats-/Jahres-Umschalter, Vergleichstabelle, FAQ |
| Kontakt | `/kontakt` | Kontaktdaten und validiertes Formular mit Erfolgszustand |
| 404 | alles andere | Gestaltete Fehlerseite mit Navigationshilfe |

### Bausteine

- **Aurora-Hintergrund** — drei driftende Farbwolken plus Raster, rein in CSS
- **Dashboard-Mockup** — als SVG gezeichnet, kein Screenshot, dadurch in jeder Auflösung scharf und in beiden Themes korrekt
- **Drei Feature-Panels** — Tippanimation mit SQL-Ausgabe, Session-Replay-Player, Latenz-Diagramm
- **Bento-Grid** mit Lichtschein, der dem Mauszeiger folgt
- **Accordion, Tarif-Umschalter, Logo-Marquee, Lesefortschritt** — alles selbst gebaut, keine UI-Bibliothek nötig

---

## Loslegen

```bash
npm install
npm run dev      # Entwicklungsserver auf http://localhost:8080
npm run build    # Produktions-Build nach dist/
npm run preview  # Build lokal ansehen
npm run lint     # ESLint
npm run typecheck
```

Voraussetzung: Node 18 oder neuer.

---

## Anpassen

### 1. Inhalte

Alle Texte, Tarife, Zitate und FAQ stehen in **einer** Datei:

```
src/data/site.ts
```

Firmenname, Slogan, E-Mail, Adresse, Navigation, Preise, Kundenstimmen, Integrationen und
Footer-Spalten — alles dort. Für die meisten Umbauten reicht diese Datei aus.

### 2. Farben

Das gesamte Farbsystem liegt als HSL-Tokens in `src/index.css`. Die Markenfarbe änderst du an
einer Stelle:

```css
:root {
  --primary: 262 83% 58%;   /* Violett */
  --accent:  190 95% 45%;   /* Türkis  */
}
.dark {
  --primary: 262 90% 68%;
  --accent:  190 95% 55%;
}
```

Wichtig: Werte ohne `hsl()` und ohne Kommas notieren — Tailwind setzt das selbst zusammen.
Die Aurora-Wolken (`--aurora-1/2/3`) und der Verlaufstext (`--text-gradient-*`) sind eigene
Tokens, damit der Kontrast in beiden Themes stimmt.

> Verwende in Komponenten immer die Tokens (`bg-primary`, `text-muted-foreground`) und nie
> feste Farben wie `bg-purple-600`. Sonst bricht der Light-Mode.

### 3. Schriften

Inter, Sora und JetBrains Mono werden in `index.html` von Google Fonts geladen. Willst du das
vermeiden (DSGVO, Offline-Betrieb), lade die Dateien nach `public/fonts/` und ersetze den
`<link>` durch eigene `@font-face`-Regeln. Die Fallback-Kette in `tailwind.config.ts` sorgt
dafür, dass die Seite auch ohne die Schriften ordentlich aussieht.

### 4. Logo

`src/components/logo.tsx` enthält ein Inline-SVG. Ersetze den `<path>` durch dein eigenes
Zeichen; der Verlauf zieht sich automatisch aus den Aurora-Tokens.

---

## Struktur

```
src/
├─ components/
│  ├─ layout/          Navbar, Footer
│  ├─ sections/        Hero, Bento, Features, Ablauf, Kundenstimmen, Preise, FAQ, CTA
│  ├─ ui/              Button, Badge, Accordion, Section, SpotlightCard
│  ├─ aurora-background.tsx
│  ├─ dashboard-mockup.tsx
│  ├─ feature-panels.tsx
│  └─ logo.tsx
├─ hooks/              use-theme, use-reveal, use-scroll-position, use-page-meta
├─ data/site.ts        ← sämtliche Inhalte
├─ lib/utils.ts        cn() und Formatierung
├─ pages/              home, features, pricing, contact, not-found
└─ index.css           Design-Tokens
```

---

## Technische Hinweise

**Scroll-Animationen.** Elemente mit `data-reveal` werden beim Scrollen eingeblendet. Ein
einziger `IntersectionObserver` für die ganze Seite übernimmt das (`src/hooks/use-reveal.ts`).
Weil der Observer seine Meldungen zusammenfasst und bei sehr schnellem Scrollen einzelne
Elemente überspringen kann, läuft zusätzlich ein Nachzügler-Durchlauf beim Scrollen mit —
so bleibt garantiert kein Inhalt unsichtbar.

Gestaffelte Verzögerung:

```tsx
import { revealDelay } from "@/hooks/use-reveal";

<div data-reveal style={revealDelay(index)}>…</div>
```

**Theme.** Die Wahl liegt im `localStorage` unter `aurora-theme`, ohne Eintrag gilt die
Systemeinstellung. Ein kleines Skript in `index.html` setzt die Klasse vor dem ersten Paint,
damit nichts aufblitzt.

**Barrierefreiheit.** Skip-Link, sichtbare Fokusringe, `aria-expanded` an Accordion und Menü,
beschriftete Formularfelder mit Fehlermeldungen per `aria-describedby`, dekorative Grafiken
mit `aria-hidden`. Sämtliche Bewegung respektiert `prefers-reduced-motion`.

**Formulare.** Newsletter und Kontaktformular validieren im Browser und zeigen einen
Erfolgszustand, versenden aber nichts. Die Stellen zum Anschließen eines echten Endpunkts
sind im Code markiert (`src/pages/contact.tsx`, `src/components/layout/footer.tsx`).

---

## Getestet

Automatisiert mit Playwright über Chromium geprüft:

- alle fünf Routen laden fehlerfrei, je genau eine `<h1>`, eigener Titel und Meta-Description
- keine Konsolenfehler, keine fehlgeschlagenen Anfragen, keine HTTP-Fehler
- Theme-Wechsel in beide Richtungen inklusive Neuladen
- mobiles Menü: öffnen, navigieren, schließen
- Preis-Umschalter monatlich/jährlich, Accordion mit `aria-expanded`
- Kontaktformular: Pflichtfelder, ungültige E-Mail, erfolgreicher Versand
- Skip-Link als erster Tab-Stopp, keine Bilder ohne `alt`, keine Links ohne Namen
- kein horizontaler Überlauf bei 320, 375, 414, 768, 1024, 1280 und 1920 px auf allen Seiten

---

## Deployment

Der Build erzeugt statische Dateien in `dist/` und läuft auf jedem Hoster
(Vercel, Netlify, Cloudflare Pages, GitHub Pages, eigener Server).

Da die Seite React Router im History-Modus nutzt, muss der Server **alle** Pfade auf
`index.html` ausliefern, sonst gibt es beim direkten Aufruf von `/preise` einen 404.

- **Vercel** — funktioniert ohne Konfiguration
- **Netlify** — `public/_redirects` mit `/*  /index.html  200`
- **Nginx** — `try_files $uri $uri/ /index.html;`

---

## Lizenz

Weiterverkauf und Nutzung liegen bei dir. Alle Firmennamen, Zitate und Kennzahlen im Template
sind erfunden und dienen nur der Demonstration — vor dem Livegang durch echte Angaben
ersetzen.
