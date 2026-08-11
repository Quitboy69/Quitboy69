import { Hero } from "@/components/sections/hero";
import { LogoMarquee } from "@/components/sections/logo-marquee";
import { BentoFeatures } from "@/components/sections/bento-features";
import { FeatureHighlights } from "@/components/sections/feature-highlights";
import { Workflow } from "@/components/sections/workflow";
import { Testimonials } from "@/components/sections/testimonials";
import { Pricing } from "@/components/sections/pricing";
import { Faq } from "@/components/sections/faq";
import { Cta } from "@/components/sections/cta";
import { usePageMeta } from "@/hooks/use-page-meta";
import { site } from "@/data/site";

export default function Home() {
  usePageMeta({
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  });

  return (
    <>
      <Hero />
      <LogoMarquee />
      <BentoFeatures />
      <FeatureHighlights />
      <Workflow />
      <Testimonials />
      <Pricing />
      <Faq />
      <Cta />
    </>
  );
}
