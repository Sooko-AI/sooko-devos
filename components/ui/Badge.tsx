import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "accent" | "success" | "warning" | "danger";
  className?: string;
}

const variantStyles = {
  default: "bg-white/[0.06] text-white/60",
  accent: "bg-accent/[0.15] text-accent-light",
  success: "bg-severity-success/[0.12] text-severity-success",
  warning: "bg-severity-medium/[0.12] text-severity-medium",
  danger: "bg-severity-high/[0.12] text-severity-high",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold tracking-wide whitespace-nowrap",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function SeverityBadge({
  severity,
}: {
  severity: "high" | "medium" | "low";
}) {
  const variant =
    severity === "high" ? "danger" : severity === "medium" ? "warning" : "accent";
  return <Badge variant={variant}>{severity.toUpperCase()}</Badge>;
}
