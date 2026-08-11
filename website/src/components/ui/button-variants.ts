import { cva } from "class-variance-authority";

/**
 * Die Varianten liegen in einer eigenen Datei, damit `button.tsx`
 * ausschließlich Komponenten exportiert — nur dann funktioniert
 * Fast Refresh im Dev-Server zuverlässig.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-glow hover:brightness-110 hover:shadow-glow-lg",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/70 hover:border-primary/30",
        ghost: "text-foreground/75 hover:bg-secondary hover:text-foreground",
        outline:
          "border border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-primary/5",
        gradient:
          "relative text-primary-foreground shadow-glow bg-[linear-gradient(110deg,hsl(var(--aurora-1)),hsl(var(--aurora-3)),hsl(var(--aurora-2)))] bg-[length:200%_auto] hover:bg-[position:right_center]",
      },
      size: {
        sm: "h-9 px-4 text-sm [&_svg]:size-4",
        md: "h-11 px-5 text-sm [&_svg]:size-4",
        lg: "h-13 px-7 text-base [&_svg]:size-[18px]",
        icon: "size-10 [&_svg]:size-[18px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
