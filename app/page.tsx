"use client";

import { useState, useRef, useEffect } from "react";
import type { Stage, ExecutionPlan, ModelReview, ConsensusReport, AnalysisResult, Task } from "@/types";
import type { AnalyzeEvent } from "@/lib/agent";
import { listHistory, saveHistory, type HistoryEntry } from "@/lib/history";

import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Timeline } from "@/components/Timeline";
import { PlanView } from "@/components/PlanView";
import { ReviewCards } from "@/components/ReviewCards";
import { ConsensusPanel } from "@/components/ConsensusPanel";
import { FinalReport } from "@/components/FinalReport";
import { LoadingState } from "@/components/LoadingState";
import { HistoryDrawer } from "@/components/HistoryDrawer";
import { Card } from "@/components/ui/Card";

export default function Home() {
  const [task, setTask] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [stage, setStage] = useState<Stage>("intake");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [reviews, setReviews] = useState<ModelReview[] | null>(null);
  const [consensus, setConsensus] = useState<ConsensusReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const currentTaskMetaRef = useRef<Task | null>(null);

  const isRunning = stage !== "intake" && stage !== "report" && !error;

  // Load history count on mount (hydration-safe).
  useEffect(() => {
    setHistoryCount(listHistory().length);
  }, []);

  // Cancel any in-flight analysis when the page unmounts (tab close, route change).
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (stage !== "intake" && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [stage]);

  function restoreFromHistory(entry: HistoryEntry) {
    abortRef.current?.abort();
    setTask(entry.result.task.prompt);
    setCodeSnippet(entry.result.task.codeSnippet || "");
    setPlan(entry.result.plan);
    setReviews(entry.result.reviews);
    setConsensus(entry.result.consensus);
    setResult(entry.result);
    setError(null);
    setStage("report");
  }

  async function runAnalysis(sampleTask?: string) {
    const t = sampleTask || task;
    if (!t.trim()) return;
    setTask(t);

    // Cancel any prior in-flight run before starting a new one.
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setPlan(null);
    setReviews(null);
    setConsensus(null);
    setResult(null);
    setError(null);
    currentTaskMetaRef.current = null;
    setStage("planning");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: t, codeSnippet, repoContext: "" }),
        signal: ac.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`Server responded ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const collected: ModelReview[] = [];
      let collectedPlan: ExecutionPlan | null = null;
      let collectedConsensus: ConsensusReport | null = null;
      let buf = "";

      readLoop: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buf.indexOf("\n\n")) !== -1) {
          const chunk = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          if (!chunk.startsWith("data: ")) continue;
          const event = JSON.parse(chunk.slice(6)) as AnalyzeEvent;

          switch (event.type) {
            case "plan":
              collectedPlan = event.plan;
              currentTaskMetaRef.current = event.task;
              setPlan(event.plan);
              setStage("reviewing");
              break;
            case "review":
              collected.push(event.review);
              setReviews([...collected]);
              if (collected.length === 3) setStage("consensus");
              break;
            case "consensus":
              collectedConsensus = event.consensus;
              setConsensus(event.consensus);
              // Save the moment we have a complete triple — protects against
              // a network drop between consensus and done.
              if (collectedPlan && currentTaskMetaRef.current) {
                const partial: AnalysisResult = {
                  task: currentTaskMetaRef.current,
                  plan: collectedPlan,
                  reviews: collected,
                  consensus: event.consensus,
                };
                setResult(partial);
                saveHistory(partial);
                setHistoryCount(listHistory().length);
              }
              break;
            case "done":
              setResult(event.result);
              setStage("report");
              // saveHistory already called on consensus; refresh count in case it wasn't.
              saveHistory(event.result);
              setHistoryCount(listHistory().length);
              break;
            case "error":
              throw new Error(event.error);
          }

          if (event.type === "done") break readLoop;
        }
      }
    } catch (err) {
      // User-initiated cancel — silently exit; UI state was already cleared.
      if (ac.signal.aborted) return;
      console.error("Analysis failed:", err);
      setError(err instanceof Error ? err.message : "Analysis failed");
      // Preserve whatever was already streamed (plan, partial reviews, etc.)
      // and surface the error inline. The user can hit Reset to start over.
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
    }
  }

  function reset() {
    abortRef.current?.abort();
    setTask("");
    setCodeSnippet("");
    setStage("intake");
    setPlan(null);
    setReviews(null);
    setConsensus(null);
    setResult(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Navbar
        showReset={stage !== "intake"}
        onReset={reset}
        onOpenHistory={() => setHistoryOpen(true)}
        historyCount={historyCount}
      />
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestore={restoreFromHistory}
      />

      {/* Hero / Intake */}
      {stage === "intake" && (
        <>
          {error && (
            <div className="max-w-[960px] mx-auto px-6 pt-6">
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                <span className="font-semibold">Analysis failed:</span> {error}
              </div>
            </div>
          )}
          <Hero
            task={task}
            setTask={setTask}
            codeSnippet={codeSnippet}
            setCodeSnippet={setCodeSnippet}
            onRun={runAnalysis}
          />
        </>
      )}

      {/* Results */}
      {stage !== "intake" && (
        <div ref={resultsRef} className="max-w-[960px] mx-auto px-6 pt-8 pb-20">
          <div className="print-hide">
            <Timeline currentStage={stage} />
          </div>

          {/* Inline error banner — preserves whatever streamed before the failure. */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 mb-6 print-hide">
              <span className="font-semibold">Analysis failed:</span> {error}
              <span className="ml-2 opacity-70">Partial results shown below. Hit Reset to start over.</span>
            </div>
          )}

          {/* Task Banner */}
          <Card className="mb-6 !px-6 !py-4 flex items-start justify-between gap-4 animate-fade-in print-hide">
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
          {isRunning && (
            <div className="print-hide">
              <LoadingState stage={stage} />
            </div>
          )}

          {/* Progressive reveal (hidden in print — FinalReport carries the canonical view) */}
          {plan && (
            <div className="print-hide">
              <PlanView plan={plan} />
            </div>
          )}
          {reviews && (
            <div className="print-hide">
              <ReviewCards reviews={reviews} />
            </div>
          )}
          {consensus && (
            <div className="print-hide">
              <ConsensusPanel consensus={consensus} />
            </div>
          )}
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
