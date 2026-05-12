import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { ModelReview } from "@/types";
import { ReviewSchema, type ReviewOutput } from "./schemas";
import { withTimeout, withRetry, errMsg } from "./async";

const REVIEW_TIMEOUT_MS = 45_000;

type Provider = "gpt" | "claude" | "gemini";

const REVIEWER_META: Record<Provider, Pick<ModelReview, "reviewer" | "model" | "color" | "icon">> = {
  gpt:    { reviewer: "Security Auditor (GPT)",         model: "gpt-4o",            color: "#10b981", icon: "G"  },
  claude: { reviewer: "Architecture Reviewer (Claude)", model: "claude-sonnet-4-6", color: "#d97706", icon: "C"  },
  gemini: { reviewer: "Quality Reviewer (Gemini)",      model: "gemini-2.5-pro",    color: "#6366f1", icon: "Ge" },
};

type Slant = {
  role: string;
  lens: string;
  emphasis: string;
};

const SLANTS: Record<Provider, Slant> = {
  gpt: {
    role: "senior security engineer performing a threat-model review",
    lens: "auth and authz flaws, injection vectors, secret handling, CSRF/XSS, rate limiting, data exposure, and token lifecycle",
    emphasis: "security and on bugs that create exploitation surface",
  },
  claude: {
    role: "senior staff engineer reviewing for architectural soundness",
    lens: "invariants, error handling, state consistency, race conditions, contract mismatches, and silent failure modes",
    emphasis: "bugs and structural correctness concerns",
  },
  gemini: {
    role: "QA lead focused on test coverage and real-world edge cases",
    lens: "concurrency, timezone and locale, unicode, empty/null/boundary inputs, third-party service failures, and missing negative-path tests",
    emphasis: "tests and edgeCases",
  },
};

function buildReviewerPrompt(
  task: string,
  codeSnippet: string | undefined,
  repoContext: string | undefined,
  slant: Slant
): string {
  let p = `You are a ${slant.role}. Your review lens is: ${slant.lens}.

Analyze the following software task and produce a structured review.

Task: ${task}`;
  if (codeSnippet) p += `\n\nCode:\n\`\`\`\n${codeSnippet}\n\`\`\``;
  if (repoContext) p += `\n\nRepository context: ${repoContext}`;
  p += `

Fill all four finding categories, but push hardest on ${slant.emphasis}:
- bugs: logic errors, incorrect behavior, race conditions
- security: injection, authz/authn gaps, token leaks, CSRF/XSS, data exposure
- tests: missing coverage for failure paths, edge cases, concurrency
- edgeCases: boundary conditions, concurrent access, timezone/unicode/locale issues

Your verdict must be one of: "Pass", "Conditional Pass", "Needs Improvement", "Fail".
Confidence is an integer 0-100 reflecting how confident you are in this review.
Notes should be 1-3 sentences summarizing the overall state of the work through your specific lens.

Return ONLY JSON matching the required schema. No prose, no markdown fences.`;
  return p;
}

// Lazy SDK singletons — keeps the call sites clean and avoids re-instantiating
// per request. Each only constructs the client when its env key is present.
let _openai: OpenAI | null = null;
let _anthropic: Anthropic | null = null;
let _google: GoogleGenAI | null = null;

function openaiClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}
function anthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}
function googleClient(): GoogleGenAI {
  if (!process.env.GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");
  if (!_google) _google = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
  return _google;
}

async function reviewWithOpenAI(prompt: string, signal?: AbortSignal): Promise<ReviewOutput> {
  const completion = await withTimeout(
    openaiClient().chat.completions.parse(
      {
        model: REVIEWER_META.gpt.model,
        messages: [{ role: "user", content: prompt }],
        response_format: zodResponseFormat(ReviewSchema, "ModelReview"),
      },
      { signal }
    ),
    REVIEW_TIMEOUT_MS,
    "OpenAI",
    signal
  );
  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) throw new Error("OpenAI response missing parsed output");
  return parsed;
}

async function reviewWithAnthropic(prompt: string, signal?: AbortSignal): Promise<ReviewOutput> {
  const message = await withTimeout(
    anthropicClient().messages.parse(
      {
        model: REVIEWER_META.claude.model,
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: zodOutputFormat(ReviewSchema) },
      },
      { signal }
    ),
    REVIEW_TIMEOUT_MS,
    "Anthropic",
    signal
  );
  if (!message.parsed_output) throw new Error("Anthropic response missing parsed_output");
  return message.parsed_output;
}

async function reviewWithGemini(prompt: string, signal?: AbortSignal): Promise<ReviewOutput> {
  const jsonSchema = z.toJSONSchema(ReviewSchema, { target: "draft-07" });
  // GoogleGenAI doesn't take an AbortSignal directly — withTimeout still races it.
  const response = await withTimeout(
    googleClient().models.generateContent({
      model: REVIEWER_META.gemini.model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
      },
    }),
    REVIEW_TIMEOUT_MS,
    "Gemini",
    signal
  );
  const text = response.text;
  if (!text) throw new Error("Empty Gemini response");
  return ReviewSchema.parse(JSON.parse(text));
}

function toModelReview(provider: Provider, output: ReviewOutput): ModelReview {
  return {
    ...REVIEWER_META[provider],
    verdict: output.verdict,
    confidence: output.confidence,
    bugs: output.bugs,
    security: output.security,
    tests: output.tests,
    edgeCases: output.edgeCases,
    notes: output.notes,
  };
}

function degradedReview(provider: Provider, reason: string): ModelReview {
  return {
    ...REVIEWER_META[provider],
    verdict: "Fail",
    confidence: 0,
    bugs: [],
    security: [],
    tests: [],
    edgeCases: [],
    notes: `Provider unavailable: ${reason}`,
  };
}

type RunOne = (prompt: string, signal?: AbortSignal) => Promise<ReviewOutput>;

const RUNNERS: Record<Provider, RunOne> = {
  gpt: reviewWithOpenAI,
  claude: reviewWithAnthropic,
  gemini: reviewWithGemini,
};

/**
 * Streaming multi-model review.
 *
 * Fires all three provider calls in parallel **eagerly** (the moment this
 * function is called — not when iteration starts) so callers can run other
 * work alongside review fan-out. Yields `ModelReview` values as each one
 * settles — slower reviewers don't block faster ones. A provider that
 * throws still yields a degraded `ModelReview` (verdict "Fail", confidence
 * 0), so the stream always produces exactly three results. Transient errors
 * (429/5xx/network) are retried once with jittered backoff before degrading.
 */
export function runMultiModelReviewStream(
  task: string,
  codeSnippet?: string,
  repoContext?: string,
  signal?: AbortSignal
): AsyncGenerator<ModelReview, void, void> {
  const providers: Provider[] = ["gpt", "claude", "gemini"];
  type Settled = { provider: Provider; review: ModelReview };
  const pending = new Map<Provider, Promise<Settled>>();

  for (const provider of providers) {
    const prompt = buildReviewerPrompt(task, codeSnippet, repoContext, SLANTS[provider]);
    const p = withRetry(() => RUNNERS[provider](prompt, signal), { label: provider, signal })
      .then(
        (output) => ({ provider, review: toModelReview(provider, output) }),
        (err) => {
          console.error(`[Sooko Reviewers] ${provider} failed:`, errMsg(err));
          return { provider, review: degradedReview(provider, errMsg(err)) };
        }
      );
    pending.set(provider, p);
  }

  return drain();

  async function* drain(): AsyncGenerator<ModelReview, void, void> {
    while (pending.size > 0) {
      const winner = await Promise.race(pending.values());
      pending.delete(winner.provider);
      yield winner.review;
    }
  }
}

/**
 * Collector wrapper — preserves the original synchronous-result API.
 * New code should prefer `runMultiModelReviewStream` for progressive UI.
 */
export async function runMultiModelReview(
  task: string,
  codeSnippet?: string,
  repoContext?: string,
  signal?: AbortSignal
): Promise<ModelReview[]> {
  const reviews: ModelReview[] = [];
  for await (const r of runMultiModelReviewStream(task, codeSnippet, repoContext, signal)) {
    reviews.push(r);
  }
  return reviews;
}
