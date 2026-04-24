"use client";

import type { ConsensusReport } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge, SeverityBadge } from "@/components/ui/Badge";

export function ConsensusPanel({ consensus }: { consensus: ConsensusReport }) {
  const confColor =
    consensus.confidence >= 80
      ? "#34d399"
      : consensus.confidence >= 65
      ? "#fbbf24"
      : "#f87171";

  return (
    <div className="mb-6 animate-fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-text-primary tracking-tight">
          Consensus Analysis
        </h2>
        <p className="text-[13px] text-white/40 mt-1">
          Cross-referenced analysis across all reviewers
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-2.5 mb-4">
        {[
          { label: "Total Findings", value: consensus.totalFindings, color: "#a5b4fc" },
          { label: "Security Issues", value: consensus.securityCount, color: "#fb923c" },
          { label: "Test Gaps", value: consensus.testGapCount, color: "#fbbf24" },
          { label: "Confidence", value: `${consensus.confidence}/100`, color: confColor },
        ].map((stat, i) => (
          <Card key={stat.label} className="!p-4 text-center">
            <p
              className="text-2xl font-bold mb-1 tracking-tight"
              style={{ color: stat.color }}
            >
              {stat.value}
            </p>
            <p className="text-[11px] text-white/35 font-semibold tracking-widest">
              {stat.label.toUpperCase()}
            </p>
          </Card>
        ))}
      </div>

      {/* Confidence Bar */}
      <Card className="!px-6 !py-4 mb-3">
        <div className="flex justify-between items-center mb-2.5">
          <span className="text-[13px] font-semibold text-white/60">
            Overall Confidence
          </span>
          <Badge
            variant={
              consensus.confidence >= 80
                ? "success"
                : consensus.confidence >= 65
                ? "warning"
                : "danger"
            }
          >
            {consensus.confidenceLevel.toUpperCase()}
          </Badge>
        </div>
        <div className="w-full h-2 rounded bg-white/[0.04] overflow-hidden">
          <div
            className="h-full rounded transition-all duration-1000"
            style={{
              width: `${consensus.confidence}%`,
              background:
                consensus.confidence >= 80
                  ? "linear-gradient(90deg, #34d399, #6ee7b7)"
                  : consensus.confidence >= 65
                  ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                  : "linear-gradient(90deg, #ef4444, #f87171)",
            }}
          />
        </div>
      </Card>

      {/* Agreed Findings */}
      <Card className="!px-6 !py-5 mb-3">
        <p className="text-[13px] font-semibold text-severity-high mb-3.5 tracking-wide">
          ⚠ AGREED FINDINGS — {consensus.agreed.length} ISSUES
        </p>
        {consensus.agreed.map((f, i) => (
          <div
            key={i}
            className={`flex items-start justify-between gap-3 py-2.5 ${
              i > 0 ? "border-t border-white/[0.04]" : ""
            }`}
          >
            <div className="flex-1">
              <p className="text-[13px] text-text-primary mb-1 leading-relaxed">
                {f.finding}
              </p>
              <p className="text-[11px] text-white/30">
                {f.reviewers.join(" · ")} — {f.category}
              </p>
            </div>
            <SeverityBadge severity={f.severity} />
          </div>
        ))}
      </Card>

      {/* Disputed Findings */}
      <Card className="!px-6 !py-5 mb-3">
        <p className="text-[13px] font-semibold text-severity-medium mb-3.5 tracking-wide">
          ⊘ DISPUTED FINDINGS — {consensus.disputed.length} ITEMS
        </p>
        {consensus.disputed.map((f, i) => (
          <div
            key={i}
            className={`flex items-start justify-between gap-3 py-2.5 ${
              i > 0 ? "border-t border-white/[0.04]" : ""
            }`}
          >
            <div className="flex-1">
              <p className="text-[13px] text-text-primary mb-1 leading-relaxed">
                {f.finding}
              </p>
              <p className="text-[11px] text-white/30">
                Flagged by {f.reviewer} only — {f.category}
              </p>
            </div>
            <SeverityBadge severity={f.severity} />
          </div>
        ))}
      </Card>

      {/* Recommendation */}
      <Card className="!px-6 !py-5 bg-accent/[0.04] !border-accent/[0.12]">
        <p className="text-[13px] font-semibold text-accent-muted mb-2 tracking-wide">
          RECOMMENDED ACTION
        </p>
        <p className="text-sm text-text-primary mb-2.5 leading-relaxed">
          {consensus.recommendation}
        </p>
        <p className="text-xs text-white/35 leading-relaxed italic">
          {consensus.rationale}
        </p>
      </Card>
    </div>
  );
}
