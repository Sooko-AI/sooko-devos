"use client";

import { useState, useRef, useEffect } from "react";
import type { Stage, ExecutionPlan, ModelReview, ConsensusReport, AnalysisResult } from "@/types";
import { delay } from "@/lib/utils";

import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Timeline } from "@/components/Timeline";
import { PlanView } from "@/components/PlanView";
import { ReviewCards } from "@/components/ReviewCards";
import { ConsensusPanel } from "@/components/ConsensusPanel";
import { FinalReport } from "@/components/FinalReport";
import { LoadingState } from "@/components/LoadingState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function Home() {
  const [task, setTask] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [stage, setStage] = useState<Stage>("intake");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [reviews, setReviews] = useState<ModelReview[] | null>(null);
  const [consensus, setConsensus] = useState<ConsensusReport | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const isRunning = stage !== "intake" && stage !== "report";

  useEffect(() => {
    if (stage !== "intake" && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [stage]);

  async function runAnalysis(sampleTask?: string) {
    const t = sampleTask || task;
    if (!t.trim()) return;
    setTask(t);

    // Reset state
    setPlan(null);
    setReviews(null);
    setConsensus(null);
    setResult(null);

    // Stage 1: Planning
    setStage("planning");
    await delay(1200);

    // Call API
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: t, codeSnippet, repoContext: "" }),
      });
      const data = await response.json();

      if (data.success && data.data) {
        const analysisResult = data.data as AnalysisResult;

        // Reveal plan
        setPlan(analysisResult.plan);
        setStage("reviewing");
        await delay(1800);

        // Reveal reviews
        setReviews(analysisResult.reviews);
        setStage("consensus");
        await delay(1400);

        // Reveal consensus + report
        setConsensus(analysisResult.consensus);
        setResult(analysisResult);
        setStage("report");
      } else {
        throw new Error(data.error || "Analysis failed");
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      // Graceful fallback: still show stages with local data
      const { generatePlan } = await import("@/lib/plan");
      const { runMultiModelReview } = await import("@/lib/reviewers");
      const { buildConsensus } = await import("@/lib/consensus");

      const p = generatePlan(t);
      setPlan(p);
      setStage("reviewing");
      await delay(1800);

      const r = runMultiModelReview(t, codeSnippet);
      setReviews(r);
      setStage("consensus");
      await delay(1400);

      const c = buildConsensus(r);
      setConsensus(c);
      setResult({
        task: {
          id: crypto.randomUUID(),
          prompt: t,
          codeSnippet,
          status: "report",
          createdAt: new Date().toISOString(),
        },
        plan: p,
        reviews: r,
        consensus: c,
      });
      setStage("report");
    }
  }

  function reset() {
    setTask("");
    setCodeSnippet("");
    setStage("intake");
    setPlan(null);
    setReviews(null);
    setConsensus(null);
    setResult(null);
  }

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Navbar showReset={stage !== "intake"} onReset={reset} />

      {/* Hero / Intake */}
      {stage === "intake" && (
        <Hero
          task={task}
          setTask={setTask}
          codeSnippet={codeSnippet}
          setCodeSnippet={setCodeSnippet}
          onRun={runAnalysis}
        />
      )}

      {/* Results */}
      {stage !== "intake" && (
        <div ref={resultsRef} className="max-w-[960px] mx-auto px-6 pt-8 pb-20">
          <Timeline currentStage={stage} />

          {/* Task Banner */}
          <Card className="mb-6 !px-6 !py-4 flex items-start justify-between gap-4 animate-fade-in">
            <div>
              <p className="text-[11px] font-semibold text-white/35 tracking-widest mb-1.5">
                ANALYZING TASK
              </p>
              <p className="text-[15px] font-medium text-text-primary leading-relaxed">
                {task}
              </p>
            </div>
            {consensus && (
              <div className="text-right shrink-0">
                <div
                  className="text-[28px] font-bold tracking-tight"
                  style={{
                    color:
                      consensus.confidence >= 80
                        ? "#34d399"
                        : consensus.confidence >= 65
                        ? "#fbbf24"
                        : "#f87171",
                  }}
                >
                  {consensus.confidence}
                </div>
                <div className="text-[11px] text-white/35 font-semibold">
                  CONFIDENCE
                </div>
              </div>
            )}
          </Card>

          {/* Loading */}
          {isRunning && <LoadingState stage={stage} />}

          {/* Progressive reveal */}
          {plan && <PlanView plan={plan} />}
          {reviews && <ReviewCards reviews={reviews} />}
          {consensus && <ConsensusPanel consensus={consensus} />}
          {result && <FinalReport result={result} />}
        </div>
      )}

      {/* Footer */}
      {stage === "intake" && (
        <div className="text-center px-6 py-8 border-t border-white/[0.03]">
          <p className="text-xs text-white/20">
            Built for Web Summit Vancouver 2026 · GitHub Copilot SDK Hackathon
          </p>
        </div>
      )}
    </div>
  );
}
