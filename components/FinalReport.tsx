"use client";

import type { AnalysisResult } from "@/types";
import { Card } from "@/components/ui/Card";
import { SeverityBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-white/40 tracking-widest uppercase mb-2.5">
        {title}
      </p>
      {children}
    </div>
  );
}

export function FinalReport({ result }: { result: AnalysisResult }) {
  const { task, plan, consensus } = result;
  const confColor =
    consensus.confidence >= 80
      ? "#34d399"
      : consensus.confidence >= 65
      ? "#fbbf24"
      : "#f87171";

  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-text-primary tracking-tight">
          Final Report
        </h2>
        <p className="text-[13px] text-white/40 mt-1">
          Complete analysis synthesized into a single deliverable
        </p>
      </div>

      <Card className="!p-0 overflow-hidden !border-accent/[0.12]">
        {/* Report Header */}
        <div className="px-8 py-7 border-b border-white/[0.05] bg-accent/[0.03]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-white/35 tracking-widest mb-2">
                SOOKO DEVOS — FINAL REPORT
              </p>
              <p className="text-lg font-bold text-text-primary tracking-tight mb-1.5">
                Trust Verification Report
              </p>
              <p className="text-[13px] text-white/40">
                Generated {formatDate(new Date().toISOString())}
              </p>
            </div>
            <div
              className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center flex-col"
              style={{
                backgroundColor: `${confColor}12`,
                border: `2px solid ${confColor}33`,
              }}
            >
              <span
                className="text-2xl font-bold"
                style={{ color: confColor }}
              >
                {consensus.confidence}
              </span>
              <span className="text-[9px] font-semibold text-white/30">
                /100
              </span>
            </div>
          </div>
        </div>

        {/* Report Body */}
        <div className="px-8 py-6">
          <ReportSection title="Task Summary">
            <p className="text-sm text-white/65 leading-relaxed">
              {task.prompt}
            </p>
          </ReportSection>

          <ReportSection title="Implementation Plan">
            {plan.steps.map((s) => (
              <div key={s.id} className="flex gap-2.5 mb-2 items-start">
                <span className="text-xs font-bold text-accent-light font-mono min-w-[20px]">
                  {s.id}.
                </span>
                <div>
                  <span className="text-[13px] font-semibold text-text-primary">
                    {s.title}
                  </span>
                  <span className="text-xs text-white/35"> — {s.description}</span>
                </div>
              </div>
            ))}
          </ReportSection>

          <ReportSection title="Key Findings — Agreed">
            {consensus.agreed.map((f, i) => (
              <div key={i} className="flex gap-2.5 mb-2 items-start">
                <SeverityBadge severity={f.severity} />
                <div>
                  <span className="text-[13px] text-text-primary">
                    {f.finding}
                  </span>
                  <span className="text-[11px] text-white/25 ml-2">
                    ({f.reviewers.join(", ")})
                  </span>
                </div>
              </div>
            ))}
          </ReportSection>

          <ReportSection title="Disputed Findings">
            {consensus.disputed.map((f, i) => (
              <div key={i} className="flex gap-2.5 mb-2 items-start">
                <SeverityBadge severity={f.severity} />
                <div>
                  <span className="text-[13px] text-white/55">
                    {f.finding}
                  </span>
                  <span className="text-[11px] text-white/25 ml-2">
                    ({f.reviewer} only)
                  </span>
                </div>
              </div>
            ))}
          </ReportSection>

          <ReportSection title="Security Concerns">
            <p className="text-[13px] text-white/55 leading-relaxed">
              {consensus.securityCount} security-related findings identified
              across all reviewers. Key concerns include insufficient rate
              limiting, missing security headers, and token lifecycle
              vulnerabilities. All high-severity security findings have
              multi-reviewer consensus.
            </p>
          </ReportSection>

          <ReportSection title="Missing Test Coverage">
            <p className="text-[13px] text-white/55 leading-relaxed">
              {consensus.testGapCount} test gaps identified. Critical failure
              paths, concurrency scenarios, and boundary conditions lack
              coverage. No load or stress testing present.
            </p>
          </ReportSection>

          {/* Recommendation Box */}
          <div className="mt-6 p-5 rounded-xl bg-accent/[0.04] border border-accent/10">
            <p className="text-[13px] font-semibold text-accent-muted mb-2">
              Recommended Action
            </p>
            <p className="text-sm text-text-primary mb-2 leading-relaxed">
              {consensus.recommendation}
            </p>
            <p className="text-xs text-white/35 italic">
              {consensus.rationale}
            </p>
          </div>
        </div>

        {/* Report Footer */}
        <div className="px-8 py-4 border-t border-white/[0.05] flex justify-between items-center">
          <p className="text-[11px] text-white/20">
            Sooko DevOS · Trust Verification Engine · v0.1.0
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-lg border border-white/[0.08] bg-transparent text-white/50 text-xs font-medium cursor-pointer hover:border-white/20 transition-all">
              Export PDF
            </button>
            <button className="px-4 py-2 rounded-lg border-none bg-gradient-to-br from-accent to-purple-600 text-white text-xs font-semibold cursor-pointer hover:opacity-90 transition-all">
              Generate Fixed Version
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
