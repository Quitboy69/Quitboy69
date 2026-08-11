import { useCallback } from "react";
import { cn } from "@/lib/utils";

type SpotlightCardProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Karte, die dem Mauszeiger mit einem weichen Lichtschein folgt.
 * Die Position wird als CSS-Variable gesetzt, gezeichnet wird in CSS
 * (`.card-glow::after`) — so läuft kein State-Update pro Mausbewegung.
 */
export function SpotlightCard({ className, children, ...props }: SpotlightCardProps) {
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    target.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
  }, []);

  return (
    <div className={cn("card-glow", className)} onMouseMove={handleMouseMove} {...props}>
      {children}
    </div>
  );
}
