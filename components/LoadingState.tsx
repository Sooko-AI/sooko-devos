"use client";

import type { Stage } from "@/types";
import { Card } from "@/components/ui/Card";

const LOADING_TEXT: Record<string, { title: string; sub: string }> = {
  planning: {
    title: "Generating execution plan...",
    sub: "Structuring task into reviewable steps",
  },
  reviewing: {
    title: "Running multi-model review...",
    sub: "GPT-4o · Claude Sonnet · Gemini 2.5 Pro",
  },
  consensus: {
    title: "Building consensus analysis...",
    sub: "Cross-referencing findings across reviewers",
  },
};

export function LoadingState({ stage }: { stage: Stage }) {
  const text = LOADING_TEXT[stage];
  if (!text) return null;

  return (
    <Card className="text-center !py-12 mb-6 animate-fade-in">
      <div className="w-9 h-9 border-[3px] border-accent/15 border-t-accent rounded-full animate-spin mx-auto mb-5" />
      <p className="text-[15px] font-semibold text-indigo-200 mb-1">
        {text.title}
      </p>
      <p className="text-[13px] text-white/30">{text.sub}</p>
    </Card>
  );
}
