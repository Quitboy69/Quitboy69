import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useReveal } from "@/hooks/use-reveal";
import Home from "@/pages/home";
import Features from "@/pages/features";
import PricingPage from "@/pages/pricing";
import Contact from "@/pages/contact";
import NotFound from "@/pages/not-found";

/**
 * Setzt die Scrollposition bei jedem Routenwechsel zurück
 * und springt zu einem Anker, falls die URL einen Hash enthält.
 */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // Ziel kann erst nach dem Rendern existieren.
      const timer = window.setTimeout(() => {
        document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
      return () => window.clearTimeout(timer);
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);

  return null;
}

function Layout() {
  const { pathname } = useLocation();

  // Scroll-Reveal nach jedem Seitenwechsel neu verdrahten.
  useReveal(pathname);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="main" className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/funktionen" element={<Features />} />
          <Route path="/preise" element={<PricingPage />} />
          <Route path="/kontakt" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Layout />
    </BrowserRouter>
  );
}
