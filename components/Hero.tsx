"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const SAMPLE_TASKS = [
  "Build a password reset flow with email verification and rate limiting",
  "Review an API endpoint for security, validation, and missing tests",
  "Assess a checkout flow implementation for bugs and edge cases",
];

interface HeroProps {
  task: string;
  setTask: (t: string) => void;
  codeSnippet: string;
  setCodeSnippet: (c: string) => void;
  onRun: (task?: string) => void;
}

export function Hero({ task, setTask, codeSnippet, setCodeSnippet, onRun }: HeroProps) {
  return (
    <div className="max-w-[720px] mx-auto px-6 pt-20 pb-16 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-accent/[0.08] border border-accent/[0.15] mb-6 text-xs font-semibold text-accent-light tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-light" />
          WEB SUMMIT VANCOUVER 2026
        </div>
        <h1 className="text-[44px] font-bold leading-[1.15] tracking-[-0.035em] mb-4 bg-gradient-to-b from-text-primary to-text-primary/65 bg-clip-text text-transparent">
          Build faster with AI.
          <br />
          Verify before you ship.
        </h1>
        <p className="text-[17px] leading-relaxed text-white/45 max-w-[540px] mx-auto">
          Sooko DevOS adds a trust layer to Copilot-powered software work —
          planning, reviewing, validating, and summarizing every task with
          multi-model intelligence.
        </p>
      </div>

      {/* Input Card */}
      <Card glow className="!p-0 overflow-hidden">
        <div className="px-7 pt-6">
          <label className="text-[13px] font-semibold text-white/50 tracking-wide block mb-2.5">
            DESCRIBE YOUR TASK
          </label>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="e.g. Build a password reset flow with email verification and rate limiting..."
            rows={3}
            className="w-full bg-transparent border-none text-text-primary text-[15px] leading-relaxed resize-none font-sans p-0"
          />
        </div>

        <div className="px-7 py-4 border-t border-white/[0.04]">
          <label className="text-xs font-semibold text-white/35 tracking-wide block mb-2">
            CODE SNIPPET (OPTIONAL)
          </label>
          <textarea
            value={codeSnippet}
            onChange={(e) => setCodeSnippet(e.target.value)}
            placeholder="Paste code for review..."
            rows={2}
            className="w-full bg-transparent border-none text-white/50 text-[13px] leading-relaxed resize-none font-mono p-0"
          />
        </div>

        <div className="px-7 py-4 border-t border-white/[0.04] flex items-center justify-between">
          <Badge className="text-white/35">
            <span className="mr-1">⎔</span> No repo connected
          </Badge>
          <button
            onClick={() => onRun()}
            disabled={!task.trim()}
            className={`px-6 py-2.5 rounded-xl border-none text-sm font-semibold transition-all tracking-tight ${
              task.trim()
                ? "bg-gradient-to-br from-accent to-purple-600 text-white cursor-pointer hover:opacity-90"
                : "bg-white/[0.06] text-white/25 cursor-default"
            }`}
          >
            Run with Sooko DevOS →
          </button>
        </div>
      </Card>

      {/* Sample Tasks */}
      <div className="mt-7 text-center">
        <p className="text-xs text-white/30 mb-3 font-medium tracking-widest">
          TRY A SAMPLE
        </p>
        <div className="flex flex-col gap-2 items-center">
          {SAMPLE_TASKS.map((s, i) => (
            <button
              key={i}
              onClick={() => onRun(s)}
              className="px-4 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-white/55 text-[13px] cursor-pointer transition-all max-w-[500px] text-left leading-snug font-sans hover:bg-white/[0.05] hover:border-accent/25 hover:text-accent-muted"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
