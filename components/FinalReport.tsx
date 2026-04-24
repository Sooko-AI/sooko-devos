"use client";

import { useEffect, useState } from "react";
import type { AnalysisResult } from "@/types";
import type { FixOutput } from "@/lib/schemas";
import { Card } from "@/components/ui/Card";
import { SeverityBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { listHistory, updateHistoryFix } from "@/lib/history";

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
  const [fixLoading, setFixLoading] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  const [fix, setFix] = useState<FixOutput | null>(null);

  // Restore a previously-generated fix when this report is loaded from history.
  useEffect(() => {
    const entry = listHistory().find((e) => e.id === task.id);
    if (entry?.fix) setFix(entry.fix);
  }, [task.id]);

  const confColor =
    consensus.confidence >= 80
      ? "#34d399"
      : consensus.confidence >= 65
      ? "#fbbf24"
      : "#f87171";

  const securityAgreed = consensus.agreed.filter((f) => f.category === "Security");
  const securityDisputed = consensus.disputed.filter((f) => f.category === "Security");
  const testAgreed = consensus.agreed.filter((f) => f.category === "Testing");
  const testDisputed = consensus.disputed.filter((f) => f.category === "Testing");
  const highSevSecurity = securityAgreed.filter((f) => f.severity === "high").length;

  async function handleGenerateFix() {
    setFixLoading(true);
    setFixError(null);
    try {
      const response = await fetch("/api/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: task.prompt,
          codeSnippet: task.codeSnippet,
          agreed: consensus.agreed,
          disputed: consensus.disputed,
        }),
      });
      const data = await response.json();
      if (!data.success || !data.data) {
        throw new Error(data.error || "Fix generation failed");
      }
      const fixOutput = data.data as FixOutput;
      setFix(fixOutput);
      updateHistoryFix(task.id, fixOutput);
    } catch (err) {
      console.error("Fix generation failed:", err);
      setFixError(err instanceof Error ? err.message : "Fix generation failed");
    } finally {
      setFixLoading(false);
    }
  }

  function handleExportPdf() {
    window.print();
  }

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

      <Card className="!p-0 overflow-hidden !border-accent/[0.12] print-report">
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
            {consensus.securityCount === 0 ? (
              <p className="text-[13px] text-white/55 leading-relaxed">
                No security findings were surfaced by any reviewer.
              </p>
            ) : (
              <>
                <p className="text-[13px] text-white/55 leading-relaxed mb-3">
                  {consensus.securityCount} security-related finding
                  {consensus.securityCount === 1 ? "" : "s"} identified across
                  all reviewers.{" "}
                  {securityAgreed.length > 0
                    ? `${securityAgreed.length} reached multi-reviewer consensus`
                    : "None reached multi-reviewer consensus"}
                  {highSevSecurity > 0
                    ? `, of which ${highSevSecurity} ${
                        highSevSecurity === 1 ? "is" : "are"
                      } high-severity`
                    : ""}
                  .
                </p>
                {securityAgreed.map((f, i) => (
                  <div key={`sa-${i}`} className="flex gap-2.5 mb-1.5 items-start">
                    <SeverityBadge severity={f.severity} />
                    <div>
                      <span className="text-[13px] text-text-primary">
                        {f.finding}
                      </span>
                      <span className="text-[11px] text-white/25 ml-2">
                        (agreed · {f.reviewers.join(", ")})
                      </span>
                    </div>
                  </div>
                ))}
                {securityDisputed.map((f, i) => (
                  <div key={`sd-${i}`} className="flex gap-2.5 mb-1.5 items-start">
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
              </>
            )}
          </ReportSection>

          <ReportSection title="Missing Test Coverage">
            {consensus.testGapCount === 0 ? (
              <p className="text-[13px] text-white/55 leading-relaxed">
                No test-coverage gaps were surfaced by any reviewer.
              </p>
            ) : (
              <>
                <p className="text-[13px] text-white/55 leading-relaxed mb-3">
                  {consensus.testGapCount} test gap
                  {consensus.testGapCount === 1 ? "" : "s"} identified across
                  all reviewers.{" "}
                  {testAgreed.length > 0
                    ? `${testAgreed.length} reached multi-reviewer consensus.`
                    : "None reached multi-reviewer consensus."}
                </p>
                {testAgreed.map((f, i) => (
                  <div key={`ta-${i}`} className="flex gap-2.5 mb-1.5 items-start">
                    <SeverityBadge severity={f.severity} />
                    <div>
                      <span className="text-[13px] text-text-primary">
                        {f.finding}
                      </span>
                      <span className="text-[11px] text-white/25 ml-2">
                        (agreed · {f.reviewers.join(", ")})
                      </span>
                    </div>
                  </div>
                ))}
                {testDisputed.map((f, i) => (
                  <div key={`td-${i}`} className="flex gap-2.5 mb-1.5 items-start">
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
              </>
            )}
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
        <div className="px-8 py-4 border-t border-white/[0.05] flex justify-between items-center print-hide">
          <p className="text-[11px] text-white/20">
            Sooko DevOS · Trust Verification Engine · v0.1.0
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              className="px-4 py-2 rounded-lg border border-white/[0.08] bg-transparent text-white/50 text-xs font-medium cursor-pointer hover:border-white/20 transition-all"
            >
              Export PDF
            </button>
            <button
              type="button"
              onClick={handleGenerateFix}
              disabled={fixLoading}
              className="px-4 py-2 rounded-lg border-none bg-gradient-to-br from-accent to-purple-600 text-white text-xs font-semibold cursor-pointer hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-wait"
            >
              {fixLoading ? "Generating…" : fix ? "Regenerate Fixed Version" : "Generate Fixed Version"}
            </button>
          </div>
        </div>
      </Card>

      {/* Fix panel */}
      {fixError && (
        <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 print-hide">
          <span className="font-semibold">Fix generation failed:</span> {fixError}
        </div>
      )}

      {fix && (
        <div className="mt-6 animate-fade-in print-report">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-text-primary tracking-tight">
              Fixed Version
            </h2>
            <p className="text-[13px] text-white/40 mt-1">
              Remediations generated from agreed and disputed findings
            </p>
          </div>
          <Card className="!border-accent/[0.12]">
            <ReportSection title="Summary">
              <p className="text-sm text-white/65 leading-relaxed">{fix.summary}</p>
            </ReportSection>

            <ReportSection title={`Fixes (${fix.fixes.length})`}>
              <div className="space-y-4">
                {fix.fixes.map((f, i) => (
                  <div key={i} className="pl-3 border-l-2 border-accent/30">
                    <div className="flex gap-2 items-start mb-1.5">
                      <SeverityBadge severity={f.severity} />
                      <span className="text-[13px] font-semibold text-text-primary">
                        {f.finding}
                      </span>
                    </div>
                    <p className="text-[13px] text-white/65 mb-2 leading-relaxed">
                      {f.remediation}
                    </p>
                    {f.codeChange?.trim() && (
                      <pre className="text-[12px] bg-black/40 border border-white/[0.06] rounded-md p-3 overflow-x-auto text-white/80 font-mono whitespace-pre-wrap">
                        {f.codeChange}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </ReportSection>

            {fix.patchedCode?.trim() && (
              <ReportSection title="Patched Code">
                <pre className="text-[12px] bg-black/40 border border-white/[0.06] rounded-md p-3 overflow-x-auto text-white/80 font-mono whitespace-pre-wrap">
                  {fix.patchedCode}
                </pre>
              </ReportSection>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
