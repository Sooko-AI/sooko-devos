"use client";

import { Shield, ServerCog, ShoppingCart, KeyRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type SampleChip = { icon: LucideIcon; label: string; prompt: string };

const SAMPLE_TASKS: SampleChip[] = [
  {
    icon: Shield,
    label: "Password reset",
    prompt: "Build a password reset flow with email verification and rate limiting",
  },
  {
    icon: ServerCog,
    label: "API security audit",
    prompt: "Review a public /users/:id API endpoint for security, authz, and missing validation",
  },
  {
    icon: ShoppingCart,
    label: "Checkout edge cases",
    prompt: "Assess a checkout flow implementation for race conditions and concurrent-cart edge cases",
  },
  {
    icon: KeyRound,
    label: "JWT middleware",
    prompt: "Implement JWT auth middleware with refresh-token rotation and revocation",
  },
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
        <div className="flex flex-wrap gap-2 justify-center">
          {SAMPLE_TASKS.map(({ icon: Icon, label, prompt }) => (
            <button
              key={label}
              onClick={() => onRun(prompt)}
              title={prompt}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3.5 py-1.5 text-[12.5px] font-medium text-white/55 cursor-pointer transition-all hover:border-accent/30 hover:text-accent-muted hover:bg-accent/[0.05]"
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
