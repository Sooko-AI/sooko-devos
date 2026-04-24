import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function Card({ children, className, glow, onClick, style }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={cn(
        "bg-white/[0.03] border border-white/[0.06] rounded-2xl p-7",
        glow && "glow-card border-accent/[0.12]",
        onClick && "cursor-pointer transition-all hover:border-white/[0.1]",
        className
      )}
    >
      {children}
    </div>
  );
}
