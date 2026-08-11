import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Moon, Sun, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { navLinks, site } from "@/data/site";
import { Logo } from "@/components/logo";
import { Button, ButtonLink } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { useScrolled, useScrollProgress } from "@/hooks/use-scroll-position";

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const scrolled = useScrolled(12);
  const progress = useScrollProgress();
  const location = useLocation();
  const routeKey = `${location.pathname}${location.hash}`;

  /*
    Das Menü wird beim Routenwechsel zurückgesetzt — auch beim Zurück-Button.
    Die Route wird dafür zusammen mit dem Zustand gespeichert und noch während
    des Renderns verglichen. Das ist Reacts empfohlener Weg; ein Effekt, der
    setState aufruft, würde einen zusätzlichen Renderdurchlauf auslösen.
  */
  const [menu, setMenu] = useState({ open: false, route: routeKey });
  if (menu.route !== routeKey) setMenu({ open: false, route: routeKey });

  const menuOpen = menu.open;
  // stabile Referenz, damit die Effekte unten nicht bei jedem Render neu laufen
  const setMenuOpen = useCallback(
    (open: boolean) => setMenu((current) => ({ ...current, open })),
    [],
  );

  // Scrollen sperren, solange das mobile Menü offen ist.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Escape schließt das Menü.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, setMenuOpen]);

  const isActive = (href: string) =>
    href.startsWith("/#") ? false : location.pathname === href;

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-primary focus:px-5 focus:py-2.5 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Zum Inhalt springen
      </a>

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled
            ? "border-b border-border/70 bg-background/75 backdrop-blur-xl"
            : "border-b border-transparent",
        )}
      >
        {/* Lesefortschritt */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px origin-left bg-gradient-to-r from-primary via-accent to-primary transition-transform duration-150"
          style={{ transform: `scaleX(${progress})` }}
        />

        <nav aria-label="Hauptnavigation" className="container flex h-16 items-center justify-between gap-4 sm:h-18">
          <Link to="/" className="rounded-full" aria-label={`${site.name} — Startseite`}>
            <Logo />
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  to={link.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                    isActive(link.href) && "bg-secondary text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Zu hellem Design wechseln" : "Zu dunklem Design wechseln"}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>

            <ButtonLink href="#anmelden" variant="ghost" size="sm" className="hidden lg:inline-flex">
              Anmelden
            </ButtonLink>

            <Link to="/preise" className="hidden sm:block">
              <Button size="sm" variant="primary">
                Kostenlos starten
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Menü schließen" : "Menü öffnen"}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </nav>
      </header>

      {/* Mobiles Menü */}
      <div
        id="mobile-menu"
        className={cn(
          "fixed inset-0 z-40 md:hidden",
          menuOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!menuOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-background/80 backdrop-blur-md transition-opacity duration-300",
            menuOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setMenuOpen(false)}
        />
        <nav
          aria-label="Mobile Navigation"
          className={cn(
            "absolute inset-x-3 top-20 rounded-3xl border bg-card p-3 shadow-lift transition-all duration-300",
            menuOpen ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
          )}
        >
          <ul className="flex flex-col">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  to={link.href}
                  tabIndex={menuOpen ? 0 : -1}
                  className="block rounded-2xl px-4 py-3.5 text-base font-medium transition-colors hover:bg-secondary"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2 border-t pt-3">
            <Link to="/preise" tabIndex={menuOpen ? 0 : -1}>
              <Button variant="primary" size="lg" className="w-full">
                Kostenlos starten
              </Button>
            </Link>
            <ButtonLink href="#anmelden" variant="ghost" size="lg" tabIndex={menuOpen ? 0 : -1}>
              Anmelden
            </ButtonLink>
          </div>
        </nav>
      </div>
    </>
  );
}
