"use client";

import { History } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface NavbarProps {
  showReset: boolean;
  onReset: () => void;
  onOpenHistory: () => void;
  historyCount?: number;
}

export function Navbar({ showReset, onReset, onOpenHistory, historyCount = 0 }: NavbarProps) {
  return (
    <nav className="flex items-center justify-between px-4 sm:px-8 py-3.5 sm:py-4 border-b border-white/[0.05] sticky top-0 bg-[#09090b]/85 backdrop-blur-xl z-50 print-hide">
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-[13px] font-bold text-white shrink-0">
          S
        </div>
        <span className="text-base font-bold tracking-tight text-text-primary truncate">
          Sooko DevOS
        </span>
        <Badge variant="accent" className="ml-1 hidden sm:inline-flex">
          BETA
        </Badge>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {showReset && (
          <button
            onClick={onReset}
            className="px-3 sm:px-4 py-1.5 rounded-lg border border-white/10 bg-transparent text-white/60 text-[12px] sm:text-[13px] font-medium hover:border-white/20 hover:text-white transition-all whitespace-nowrap"
          >
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New Analysis</span>
          </button>
        )}
        <button
          onClick={onOpenHistory}
          aria-label="Open history"
          title="History"
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-white/10 bg-transparent text-white/60 text-[12px] sm:text-[13px] font-medium hover:border-white/20 hover:text-white transition-all"
        >
          <History className="w-3.5 h-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">History</span>
          {historyCount > 0 && (
            <span className="text-[10px] font-mono text-white/40 tabular-nums">
              {historyCount}
            </span>
          )}
        </button>
        <Badge className="text-white/40 hidden md:inline-flex">v0.1.0</Badge>
      </div>
    </nav>
  );
}
