import { ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "",
        secondary: "",
        ghost: "",
        danger: "",
      },
      size: {
        sm: "px-2.5 py-1.5 text-xs",
        md: "px-3.5 py-2 text-sm",
        lg: "px-5 py-2.5 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const VARIANT_STYLE: Record<string, React.CSSProperties> = {
  primary: { background: "var(--primary)", color: "#fff", border: "1px solid transparent" },
  secondary: { background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--border)" },
  ghost: { background: "transparent", color: "var(--ink-secondary)", border: "1px solid transparent" },
  danger: { background: "var(--danger)", color: "#fff", border: "1px solid transparent" },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", style, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      style={{ cursor: "pointer", ...VARIANT_STYLE[variant ?? "primary"], ...style }}
      {...props}
    />
  );
});
