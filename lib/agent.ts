/**
 * Sooko DevOS — Agent workflow orchestrator.
 *
 *   - Plan step  : Copilot SDK agent session produces a model-generated ExecutionPlan.
 *                  Falls back to OpenAI direct if the Copilot SDK is unavailable.
 *   - Reviews    : Direct provider SDKs (OpenAI / Anthropic / Google) fan out in parallel
 *                  alongside the plan step (not after it).
 *   - Consensus  : LLM judge clusters findings, with Jaccard overlap as a deterministic
 *                  fallback if the judge call fails.
 *
 * Fault tolerance:
 *   - Every provider call has a timeout and one retry on transient (429/5xx/network) errors.
 *   - The workflow accepts an upstream AbortSignal (forwarded from the SSE request).
 *   - If the plan step fails, the orchestrator aborts the in-flight review fan-out so
 *     no tokens are spent on a doomed run.
 *
 * Requires:
 *   - GitHub Copilot CLI installed and authenticated (used by @github/copilot-sdk).
 *   - OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY in .env.local.
 */

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type {
  ExecutionPlan,
  AnalysisResult,
  Task,
  ModelReview,
  ConsensusReport,
} from "@/types";
import { runMultiModelReviewStream } from "./reviewers";
import { buildConsensus } from "./consensus";
import { PlanSchema } from "./schemas";
import { withTimeout, withRetry, errMsg } from "./async";

export type AnalyzeEvent =
  | { type: "plan"; task: Task; plan: ExecutionPlan }
  | { type: "review"; review: ModelReview }
  | { type: "consensus"; consensus: ConsensusReport }
  | { type: "done"; result: AnalysisResult }
  | { type: "error"; error: string };

const AGENT_INSTRUCTIONS = `You are the Sooko DevOS planning agent.
Your job: produce a concise, actionable execution plan for a software task.

Return ONLY JSON (no markdown fences, no prose) matching this shape:
{
  "objective": "<one-sentence restatement of the task>",
  "steps": [
    { "id": 1, "title": "<short imperative>", "description": "<1-2 sentences of specific action>", "status": "complete" | "in-progress" | "pending" }
  ]
}

Rules:
- Produce exactly 5 or 6 steps.
- Each step must be concrete and testable — no generic filler.
- Mark all but the final step as "complete"; mark the final step as "pending".
  (The plan is shown to a human as a post-hoc summary of completed work plus the remaining rollout step.)
- Do not include any text outside the JSON object.`;

// Copilot SDK is best-effort; on Node < 22.5 it fails fast with ERR_UNKNOWN_BUILTIN_MODULE.
// Cap it at 15s so a slow/hung SDK doesn't block the OpenAI fallback.
const COPILOT_PLAN_TIMEOUT_MS = 15_000;
const OPENAI_PLAN_TIMEOUT_MS = 45_000;
const COPILOT_PLAN_MODEL = "gpt-4.1";
const OPENAI_PLAN_MODEL = "gpt-4o";

function buildPlanPrompt(task: string, code?: string, repo?: string): string {
  let p = `Task: ${task}`;
  if (code) p += `\n\nCode context:\n\`\`\`\n${code}\n\`\`\``;
  if (repo) p += `\n\nRepository context: ${repo}`;
  return p;
}

function stripFences(raw: string): string {
  return raw.replace(/```(?:json)?\s*|\s*```/g, "").trim();
}

let _openai: OpenAI | null = null;
function openaiClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

async function generatePlanViaSDK(
  task: string,
  code: string | undefined,
  repo: string | undefined,
  signal?: AbortSignal
): Promise<ExecutionPlan> {
  const { CopilotClient, approveAll } = await import("@github/copilot-sdk");
  const client = new CopilotClient();
  try {
    const session = await client.createSession({
      model: COPILOT_PLAN_MODEL,
      onPermissionRequest: approveAll,
      systemMessage: { mode: "replace", content: AGENT_INSTRUCTIONS },
    });
    try {
      const event = await withTimeout(
        session.sendAndWait(
          { prompt: buildPlanPrompt(task, code, repo) },
          COPILOT_PLAN_TIMEOUT_MS
        ),
        COPILOT_PLAN_TIMEOUT_MS,
        "Copilot SDK",
        signal
      );
      const content = event?.data?.content;
      if (!content) throw new Error("Empty plan response from Copilot SDK");
      return PlanSchema.parse(JSON.parse(stripFences(content)));
    } finally {
      await session.disconnect().catch(() => {});
    }
  } finally {
    await client.stop().catch(() => {});
  }
}

async function generatePlanViaOpenAI(
  task: string,
  code: string | undefined,
  repo: string | undefined,
  signal?: AbortSignal
): Promise<ExecutionPlan> {
  const messages = [
    { role: "system" as const, content: AGENT_INSTRUCTIONS },
    { role: "user" as const, content: buildPlanPrompt(task, code, repo) },
  ];
  const completion = await withTimeout(
    openaiClient().chat.completions.parse(
      {
        model: OPENAI_PLAN_MODEL,
        messages,
        response_format: zodResponseFormat(PlanSchema, "ExecutionPlan"),
      },
      { signal }
    ),
    OPENAI_PLAN_TIMEOUT_MS,
    "OpenAI plan",
    signal
  );
  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) throw new Error("OpenAI plan response missing parsed output");
  return parsed;
}

async function generateExecutionPlan(
  task: string,
  code: string | undefined,
  repo: string | undefined,
  signal?: AbortSignal
): Promise<ExecutionPlan> {
  // Tier 1: Copilot SDK. Best-effort. No retry — SDK errors are usually
  // environmental (Node version, auth), not transient.
  try {
    const plan = await generatePlanViaSDK(task, code, repo, signal);
    console.log("[Sooko Agent] Plan generated via Copilot SDK");
    return plan;
  } catch (err) {
    console.warn("[Sooko Agent] Copilot SDK plan failed, falling back to OpenAI:", errMsg(err));
  }
  // Tier 2: OpenAI direct. Retry once on transient errors.
  const plan = await withRetry(
    () => generatePlanViaOpenAI(task, code, repo, signal),
    { label: "openai-plan", signal }
  );
  console.log("[Sooko Agent] Plan generated via OpenAI");
  return plan;
}

/**
 * Streams the full analysis: plan → per-reviewer results as each settles →
 * consensus → done. Yields one event per milestone; consumers (the SSE route)
 * can forward each event to the client immediately.
 *
 * Plan and review fan-out run concurrently. The plan event is yielded first
 * regardless of which completes earlier, so the UI's state machine sees
 * plan → reviews in order.
 */
export async function* runAgentWorkflowStream(
  taskPrompt: string,
  codeSnippet?: string,
  repoContext?: string,
  upstreamSignal?: AbortSignal
): AsyncGenerator<AnalyzeEvent, void, void> {
  // Local controller chained to the upstream signal so we can abort
  // in-flight review fan-out if the plan step fails outright.
  const localController = new AbortController();
  const signal = upstreamSignal
    ? AbortSignal.any([upstreamSignal, localController.signal])
    : localController.signal;

  const task: Task = {
    id: crypto.randomUUID(),
    prompt: taskPrompt,
    codeSnippet,
    repoContext,
    status: "planning",
    createdAt: new Date().toISOString(),
  };

  // Kick off both in parallel. runMultiModelReviewStream launches its
  // promises eagerly, so reviews are running while we await the plan.
  const planPromise = generateExecutionPlan(taskPrompt, codeSnippet, repoContext, signal);
  const reviewIter = runMultiModelReviewStream(taskPrompt, codeSnippet, repoContext, signal);

  let plan: ExecutionPlan;
  try {
    plan = await planPromise;
  } catch (err) {
    // Plan failed — cancel the reviews to save tokens, then surface.
    localController.abort();
    throw err;
  }
  yield { type: "plan", task, plan };

  const reviews: ModelReview[] = [];
  for await (const review of reviewIter) {
    reviews.push(review);
    yield { type: "review", review };
  }

  const consensus = await buildConsensus(reviews, signal);
  yield { type: "consensus", consensus };

  task.status = "report";
  yield { type: "done", result: { task, plan, reviews, consensus } };
}

export { AGENT_INSTRUCTIONS };
