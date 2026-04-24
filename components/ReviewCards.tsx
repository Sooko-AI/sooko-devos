"use client";

import { useState } from "react";
import type { ModelReview } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function ReviewCards({ reviews }: { reviews: ModelReview[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

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
      <div className="grid grid-cols-3 gap-3">
        {reviews.map((r, i) => {
          const isExpanded = expanded === i;
          return (
            <Card
              key={r.reviewer}
              onClick={() => setExpanded(isExpanded ? null : i)}
              className={`!p-0 transition-all ${
                isExpanded ? `border-[${r.color}]/20` : ""
              }`}
              style={{
                animationDelay: `${i * 0.08}s`,
                borderColor: isExpanded ? `${r.color}33` : undefined,
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
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-4 border-t border-white/[0.04]">
                  {[
                    { title: "Bugs", items: r.bugs, color: "#f87171" },
                    { title: "Security Issues", items: r.security, color: "#fb923c" },
                    { title: "Missing Tests", items: r.tests, color: "#fbbf24" },
                    { title: "Edge Cases", items: r.edgeCases, color: "#60a5fa" },
                  ].map((section) => (
                    <div key={section.title} className="mb-3.5">
                      <p
                        className="text-[11px] font-semibold tracking-widest mb-1.5"
                        style={{ color: section.color }}
                      >
                        {section.title.toUpperCase()}
                      </p>
                      {section.items.map((item, j) => (
                        <p
                          key={j}
                          className="text-xs text-white/55 mb-1 leading-relaxed pl-2.5"
                          style={{
                            borderLeft: `2px solid ${section.color}25`,
                          }}
                        >
                          {item}
                        </p>
                      ))}
                    </div>
                  ))}
                  <p className="text-xs text-white/40 mt-3 leading-relaxed italic">
                    {r.notes}
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-white/25 text-center mt-2.5">
        Click a reviewer card to expand findings
      </p>
    </div>
  );
}
