/**
 * Sooko DevOS — Copilot SDK Agent Integration
 *
 * This module integrates the GitHub Copilot SDK to power the agentic workflow.
 * The agent uses the SDK's runtime for plan generation, code review orchestration,
 * and report synthesis.
 *
 * Architecture:
 *   User Request → Copilot SDK Agent → Plan → Multi-Model Review → Consensus → Report
 *
 * The SDK communicates with the Copilot CLI via JSON-RPC. When BYOK keys are
 * configured, the agent can route to specific model providers (OpenAI, Anthropic,
 * Google) for the multi-model review step.
 *
 * Environment variables:
 *   COPILOT_SDK_MODE       – "live" | "mock" (defaults to "mock" for hackathon demo)
 *   OPENAI_API_KEY         – For GPT reviewer (BYOK)
 *   ANTHROPIC_API_KEY      – For Claude reviewer (BYOK)
 *   GOOGLE_AI_API_KEY      – For Gemini reviewer (BYOK)
 */

import type { ExecutionPlan, ModelReview, ConsensusReport, AnalysisResult, Task } from "@/types";
import { generatePlan } from "./plan";
import { runMultiModelReview } from "./reviewers";
import { buildConsensus } from "./consensus";

// ─── SDK Client Setup ────────────────────────────────────────────────────────

let sdkClient: any = null;

/**
 * Initialize the Copilot SDK client.
 * In live mode, this creates a real SDK session.
 * In mock mode (default for hackathon), uses deterministic logic.
 */
async function initSdkClient() {
  const mode = process.env.COPILOT_SDK_MODE || "mock";

  if (mode === "live") {
    try {
      const { CopilotClient } = await import("@github/copilot-sdk");
      sdkClient = new CopilotClient({
        // BYOK configuration for multi-model access
        providers: {
          openai: process.env.OPENAI_API_KEY
            ? { apiKey: process.env.OPENAI_API_KEY }
            : undefined,
          anthropic: process.env.ANTHROPIC_API_KEY
            ? { apiKey: process.env.ANTHROPIC_API_KEY }
            : undefined,
        },
      });
      console.log("[Sooko Agent] Copilot SDK client initialized in LIVE mode");
    } catch (err) {
      console.warn("[Sooko Agent] SDK init failed, falling back to mock mode:", err);
      sdkClient = null;
    }
  } else {
    console.log("[Sooko Agent] Running in MOCK mode (set COPILOT_SDK_MODE=live for SDK)");
  }
}

// ─── Agent Workflow ──────────────────────────────────────────────────────────

/**
 * The core agent instructions that define the Sooko DevOS agent persona.
 * These are passed to the Copilot SDK as the agent system prompt.
 */
const AGENT_INSTRUCTIONS = `You are the Sooko DevOS agent.
Your purpose is to transform AI-generated software work into decision-ready, trustworthy output.

## Core Workflow
1. Understand the task and restate it clearly.
2. Produce a concise execution plan with 5-6 actionable steps.
3. Evaluate generated code or implementation for quality.
4. Identify: Bugs, Security issues, Missing tests, Edge cases.
5. Compare findings across multiple reviewers.
6. Produce a final recommendation with a confidence score (0-100).

## Output Format
Return structured JSON with: taskSummary, executionPlan, findings, consensus, risks, recommendedAction, confidenceScore.

## Principles
- Be precise, not verbose
- Prioritize correctness over creativity
- Highlight uncertainty clearly
- Never assume correctness from a single source`;

/**
 * Run the full Sooko DevOS agent workflow.
 *
 * When the Copilot SDK is available (live mode), this uses the SDK to:
 * 1. Generate an execution plan via the agent runtime
 * 2. Orchestrate multi-model review using BYOK providers
 * 3. Build consensus across reviewer outputs
 *
 * In mock mode, uses deterministic local engines.
 */
export async function runAgentWorkflow(
  taskPrompt: string,
  codeSnippet?: string,
  repoContext?: string
): Promise<AnalysisResult> {
  // Initialize SDK on first call
  if (sdkClient === undefined) {
    await initSdkClient();
  }

  const task: Task = {
    id: crypto.randomUUID(),
    prompt: taskPrompt,
    codeSnippet,
    repoContext,
    status: "planning",
    createdAt: new Date().toISOString(),
  };

  let plan: ExecutionPlan;
  let reviews: ModelReview[];
  let consensus: ConsensusReport;

  if (sdkClient) {
    // ── Live SDK Mode ──
    // Use Copilot SDK agent to generate plan
    const agentResponse = await sdkClient.run({
      instructions: AGENT_INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content: buildAgentPrompt(taskPrompt, codeSnippet, repoContext),
        },
      ],
      tools: [
        {
          name: "generate_plan",
          description: "Generate a structured execution plan for a software task",
          parameters: {
            type: "object",
            properties: {
              task: { type: "string", description: "The software task to plan" },
            },
          },
        },
        {
          name: "review_code",
          description: "Review code for bugs, security issues, and quality",
          parameters: {
            type: "object",
            properties: {
              code: { type: "string", description: "Code to review" },
              context: { type: "string", description: "Task context" },
            },
          },
        },
      ],
    });

    // Parse structured output from agent
    const result = parseAgentResponse(agentResponse);
    plan = result.plan || generatePlan(taskPrompt);
    reviews = result.reviews || runMultiModelReview(taskPrompt, codeSnippet);
    consensus = result.consensus || buildConsensus(reviews);
  } else {
    // ── Mock Mode (Hackathon Demo) ──
    plan = generatePlan(taskPrompt);
    reviews = runMultiModelReview(taskPrompt, codeSnippet);
    consensus = buildConsensus(reviews);
  }

  task.status = "report";

  return { task, plan, reviews, consensus };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildAgentPrompt(
  task: string,
  code?: string,
  repo?: string
): string {
  let prompt = `Analyze this software task and provide a structured review:\n\nTask: ${task}`;
  if (code) prompt += `\n\nCode to review:\n\`\`\`\n${code}\n\`\`\``;
  if (repo) prompt += `\n\nRepository context: ${repo}`;
  prompt += `\n\nProvide your response as structured JSON with: executionPlan, bugs, securityIssues, missingTests, edgeCases, confidenceScore, and recommendedAction.`;
  return prompt;
}

function parseAgentResponse(response: any): {
  plan?: ExecutionPlan;
  reviews?: ModelReview[];
  consensus?: ConsensusReport;
} {
  try {
    if (response?.content) {
      const textBlock = response.content.find((b: any) => b.type === "text");
      if (textBlock?.text) {
        const json = JSON.parse(
          textBlock.text.replace(/```json|```/g, "").trim()
        );
        return json;
      }
    }
  } catch {
    // Fall back to mock engines
  }
  return {};
}

export { AGENT_INSTRUCTIONS };
