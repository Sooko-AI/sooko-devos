"use client";

import type { Stage } from "@/types";

const VISIBLE_STAGES: { key: Stage; label: string }[] = [
  { key: "planning", label: "Plan" },
  { key: "reviewing", label: "Review" },
  { key: "consensus", label: "Consensus" },
  { key: "report", label: "Report" },
];

const STAGE_ORDER: Stage[] = ["intake", "planning", "reviewing", "consensus", "report"];

export function Timeline({ currentStage }: { currentStage: Stage }) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage);

  return (
    <div className="flex items-center justify-center gap-0 mb-10 animate-fade-in">
      {VISIBLE_STAGES.map((s, i) => {
        const idx = STAGE_ORDER.indexOf(s.key);
        const isActive = idx === currentIdx;
        const isComplete = idx < currentIdx;

        return (
          <div key={s.key} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-400 ${
                  isComplete
                    ? "bg-accent text-white"
                    : isActive
                    ? "bg-accent/20 text-accent-muted border-2 border-accent animate-pulse"
                    : "bg-white/[0.04] text-white/20 border-2 border-transparent"
                }`}
              >
                {isComplete ? "✓" : i + 1}
              </div>
              <span
                className={`text-xs font-semibold tracking-wide transition-colors duration-400 ${
                  isComplete
                    ? "text-accent-muted"
                    : isActive
                    ? "text-indigo-200"
                    : "text-white/20"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < VISIBLE_STAGES.length - 1 && (
              <div
                className={`w-10 h-px mx-3 transition-colors duration-400 ${
                  isComplete ? "bg-accent/40" : "bg-white/[0.06]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
