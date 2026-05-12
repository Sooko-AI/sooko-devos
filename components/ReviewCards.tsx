"use client";

import { useState } from "react";
import type { ModelReview } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function ReviewCards({ reviews }: { reviews: ModelReview[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const active = activeIdx !== null ? reviews[activeIdx] : null;

  return (
    <div className="mb-6 animate-fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-text-primary tracking-tight">
          Model Reviews
        </h2>
        <p className="text-[13px] text-white/40 mt-1">
          Independent analysis from three AI models
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {reviews.map((r, i) => {
          const isActive = activeIdx === i;
          return (
            <Card
              key={r.reviewer}
              onClick={() => setActiveIdx(isActive ? null : i)}
              className="!p-0 cursor-pointer transition-all"
              style={{
                animationDelay: `${i * 0.08}s`,
                borderColor: isActive ? `${r.color}55` : undefined,
                boxShadow: isActive ? `0 0 0 1px ${r.color}33, 0 8px 24px -12px ${r.color}55` : undefined,
              }}
            >
              <div className="p-5 pb-4">
                {/* Header */}
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold"
                    style={{
                      backgroundColor: `${r.color}18`,
                      color: r.color,
                    }}
                  >
                    {r.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {r.reviewer}
                    </p>
                    <p className="text-[11px] text-white/30 font-mono">
                      {r.model}
                    </p>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex gap-2 flex-wrap mb-3">
                  <Badge
                    variant={
                      r.verdict === "Conditional Pass" ? "warning" : "danger"
                    }
                  >
                    {r.verdict}
                  </Badge>
                  <Badge>{r.confidence}/100</Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "Bugs", count: r.bugs.length, color: "#f87171" },
                    { label: "Security", count: r.security.length, color: "#fb923c" },
                    { label: "Tests", count: r.tests.length, color: "#fbbf24" },
                    { label: "Edge Cases", count: r.edgeCases.length, color: "#60a5fa" },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="flex items-center gap-1.5 text-xs text-white/45"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: m.color }}
                      />
                      {m.count} {m.label}
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-[11px] text-white/30">
                  {isActive ? "Click to collapse" : "Click for findings"}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Full-width detail panel — sits BELOW the grid so the expanded
          content gets proper reading width and the row stays balanced. */}
      {active && activeIdx !== null && (
        <Card
          key={`detail-${activeIdx}`}
          className="!p-0 mt-3 animate-fade-in overflow-hidden"
          style={{
            borderColor: `${active.color}33`,
            boxShadow: `0 0 0 1px ${active.color}22`,
          }}
        >
          {/* Detail header */}
          <div
            className="flex items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.06]"
            style={{
              background: `linear-gradient(180deg, ${active.color}10 0%, transparent 100%)`,
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  backgroundColor: `${active.color}22`,
                  color: active.color,
                }}
              >
                {active.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">
                  {active.reviewer} — findings
                </p>
                <p className="text-[11px] text-white/35 font-mono truncate">
                  {active.model} · verdict: {active.verdict} · confidence {active.confidence}/100
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveIdx(null)}
              className="text-white/40 hover:text-white/80 text-xs px-2 py-1 rounded transition-colors shrink-0"
              aria-label="Close findings"
            >
              ✕ Close
            </button>
          </div>

          {/* Detail body — two columns on wide screens, stacks on narrow */}
          <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {[
              { title: "Bugs", items: active.bugs, color: "#f87171" },
              { title: "Security Issues", items: active.security, color: "#fb923c" },
              { title: "Missing Tests", items: active.tests, color: "#fbbf24" },
              { title: "Edge Cases", items: active.edgeCases, color: "#60a5fa" },
            ].map((section) => (
              <div key={section.title}>
                <p
                  className="text-[11px] font-semibold tracking-widest mb-2"
                  style={{ color: section.color }}
                >
                  {section.title.toUpperCase()}
                  <span className="ml-2 text-white/30 font-normal">
                    {section.items.length}
                  </span>
                </p>
                {section.items.length === 0 ? (
                  <p className="text-xs text-white/25 italic">No findings.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {section.items.map((item, j) => (
                      <li
                        key={j}
                        className="text-[13px] text-white/65 leading-relaxed pl-3"
                        style={{ borderLeft: `2px solid ${section.color}30` }}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {active.notes && (
            <div className="px-6 pb-5 -mt-1">
              <p className="text-[11px] font-semibold tracking-widest text-white/40 mb-1.5">
                REVIEWER NOTES
              </p>
              <p className="text-[13px] text-white/55 leading-relaxed italic">
                {active.notes}
              </p>
            </div>
          )}
        </Card>
      )}

      {!active && (
        <p className="text-xs text-white/25 text-center mt-2.5">
          Click a reviewer card to expand findings
        </p>
      )}
    </div>
  );
}
