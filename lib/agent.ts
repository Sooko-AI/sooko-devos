/**
 * Sooko DevOS — Agent workflow orchestrator.
 *
 * In live mode (COPILOT_SDK_MODE=live):
 *   - Plan step  : Copilot SDK agent session produces a model-generated ExecutionPlan.
 *   - Reviews    : Direct provider SDKs (OpenAI / Anthropic / Google) fan out in parallel.
 *   - Consensus  : Deterministic overlap of the real review outputs.
 *
 * In mock mode: templated plan + hardcoded reviewer strings + deterministic consensus.
 *
 * Live mode requires:
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
import { generatePlan } from "./plan";
import { runMultiModelReviewStream } from "./reviewers";
import { buildConsensus } from "./consensus";
import { PlanSchema } from "./schemas";

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

const PLAN_TIMEOUT_MS = 45_000;
// The Copilot CLI exposes a curated model list (`auto`, `gpt-4.1`, `gpt-5-mini`,
// `claude-haiku-4.5`). We use gpt-4.1 for the plan step; the OpenAI fallback
// uses gpt-4o independently.
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

async function generatePlanViaSDK(
  task: string,
  code?: string,
  repo?: string
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
      const event = await session.sendAndWait(
        { prompt: buildPlanPrompt(task, code, repo) },
        PLAN_TIMEOUT_MS
      );
      const content = event?.data?.content;
      if (!content) throw new Error("Empty plan response from Copilot SDK");
      const parsed = PlanSchema.parse(JSON.parse(stripFences(content)));
      return parsed;
    } finally {
      await session.disconnect().catch(() => {});
    }
  } finally {
    await client.stop().catch(() => {});
  }
}

async function generatePlanViaOpenAI(
  task: string,
  code?: string,
  repo?: string
): Promise<ExecutionPlan> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [
    { role: "system" as const, content: AGENT_INSTRUCTIONS },
    { role: "user" as const, content: buildPlanPrompt(task, code, repo) },
  ];
  const completion = await client.chat.completions.parse({
    model: OPENAI_PLAN_MODEL,
    messages,
    response_format: zodResponseFormat(PlanSchema, "ExecutionPlan"),
  });
  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) throw new Error("OpenAI plan response missing parsed output");
  return parsed;
}

async function generatePlanLive(
  task: string,
  code?: string,
  repo?: string
): Promise<ExecutionPlan> {
  // Tier 1: Copilot SDK (authoritative; requires Node 22+ for the bundled CLI).
  try {
    const plan = await generatePlanViaSDK(task, code, repo);
    console.log("[Sooko Agent] Plan generated via Copilot SDK");
    return plan;
  } catch (err) {
    console.warn(
      "[Sooko Agent] Copilot SDK plan failed, falling back to OpenAI:",
      err instanceof Error ? err.message : err
    );
  }
  // Tier 2: OpenAI direct (always available when OPENAI_API_KEY is set).
  try {
    const plan = await generatePlanViaOpenAI(task, code, repo);
    console.log("[Sooko Agent] Plan generated via OpenAI");
    return plan;
  } catch (err) {
    console.warn(
      "[Sooko Agent] OpenAI plan failed, falling back to templated plan:",
      err instanceof Error ? err.message : err
    );
  }
  // Tier 3: Templated.
  return generatePlan(task);
}

/**
 * Streams the full analysis: plan → per-reviewer results as each settles →
 * consensus → done. Yields one event per milestone; consumers (the SSE route)
 * can forward each event to the client immediately.
 */
export async function* runAgentWorkflowStream(
  taskPrompt: string,
  codeSnippet?: string,
  repoContext?: string
): AsyncGenerator<AnalyzeEvent, void, void> {
  const mode = process.env.COPILOT_SDK_MODE || "mock";
  const isLive = mode === "live";

  const task: Task = {
    id: crypto.randomUUID(),
    prompt: taskPrompt,
    codeSnippet,
    repoContext,
    status: "planning",
    createdAt: new Date().toISOString(),
  };

  const plan: ExecutionPlan = isLive
    ? await generatePlanLive(taskPrompt, codeSnippet, repoContext)
    : generatePlan(taskPrompt);
  yield { type: "plan", task, plan };

  const reviews: ModelReview[] = [];
  for await (const review of runMultiModelReviewStream(
    taskPrompt,
    codeSnippet,
    repoContext
  )) {
    reviews.push(review);
    yield { type: "review", review };
  }

  const consensus = await buildConsensus(reviews);
  yield { type: "consensus", consensus };

  task.status = "report";
  yield { type: "done", result: { task, plan, reviews, consensus } };
}

export { AGENT_INSTRUCTIONS };
