"use client";

import { Badge } from "@/components/ui/Badge";

interface NavbarProps {
  showReset: boolean;
  onReset: () => void;
}

export function Navbar({ showReset, onReset }: NavbarProps) {
  return (
    <nav className="flex items-center justify-between px-8 py-4 border-b border-white/[0.05] sticky top-0 bg-[#09090b]/85 backdrop-blur-xl z-50">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-[13px] font-bold text-white">
          S
        </div>
        <span className="text-base font-bold tracking-tight text-text-primary">
          Sooko DevOS
        </span>
        <Badge variant="accent" className="ml-1">
          BETA
        </Badge>
      </div>
      <div className="flex items-center gap-4">
        {showReset && (
          <button
            onClick={onReset}
            className="px-4 py-1.5 rounded-lg border border-white/10 bg-transparent text-white/60 text-[13px] font-medium hover:border-white/20 hover:text-white transition-all"
          >
            New Analysis
          </button>
        )}
        <Badge className="text-white/40">v0.1.0</Badge>
      </div>
    </nav>
  );
}
