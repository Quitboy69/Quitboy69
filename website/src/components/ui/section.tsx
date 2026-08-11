import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  id?: string;
}

export function Section({ className, children, ...props }: SectionProps) {
  return (
    <section className={cn("relative py-24 sm:py-32", className)} {...props}>
      {children}
    </section>
  );
}

interface SectionHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        align === "center" ? "mx-auto max-w-3xl items-center text-center" : "max-w-2xl items-start",
        className,
      )}
    >
      {eyebrow && (
        <Badge variant="primary" data-reveal>
          {eyebrow}
        </Badge>
      )}
      <h2
        data-reveal
        style={{ "--reveal-delay": "70ms" } as React.CSSProperties}
        className="text-balance font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-[2.75rem]"
      >
        {title}
      </h2>
      {description && (
        <p
          data-reveal
          style={{ "--reveal-delay": "140ms" } as React.CSSProperties}
          className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          {description}
        </p>
      )}
    </div>
  );
}
