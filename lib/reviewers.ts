import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { ModelReview } from "@/types";
import { ReviewSchema, type ReviewOutput } from "./schemas";

const TIMEOUT_MS = 45_000;

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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

async function reviewWithOpenAI(prompt: string): Promise<ReviewOutput> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await withTimeout(
    client.chat.completions.parse({
      model: REVIEWER_META.gpt.model,
      messages: [{ role: "user", content: prompt }],
      response_format: zodResponseFormat(ReviewSchema, "ModelReview"),
    }),
    TIMEOUT_MS,
    "OpenAI"
  );
  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) throw new Error("OpenAI response missing parsed output");
  return parsed;
}

async function reviewWithAnthropic(prompt: string): Promise<ReviewOutput> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await withTimeout(
    client.messages.parse({
      model: REVIEWER_META.claude.model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(ReviewSchema) },
    }),
    TIMEOUT_MS,
    "Anthropic"
  );
  if (!message.parsed_output) throw new Error("Anthropic response missing parsed_output");
  return message.parsed_output;
}

async function reviewWithGemini(prompt: string): Promise<ReviewOutput> {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
  const jsonSchema = z.toJSONSchema(ReviewSchema, { target: "draft-07" });
  const response = await withTimeout(
    ai.models.generateContent({
      model: REVIEWER_META.gemini.model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
      },
    }),
    TIMEOUT_MS,
    "Gemini"
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

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

type RunOne = (prompt: string) => Promise<ReviewOutput>;

const RUNNERS: Record<Provider, RunOne> = {
  gpt: reviewWithOpenAI,
  claude: reviewWithAnthropic,
  gemini: reviewWithGemini,
};

/**
 * Streaming multi-model review.
 *
 * Fires all three provider calls in parallel (each with its own specialist
 * prompt) and yields `ModelReview` values as each one settles — slower
 * reviewers don't block faster ones. A provider that throws still yields
 * a degraded `ModelReview` (verdict "Fail", confidence 0), so the stream
 * always produces exactly three results.
 */
export async function* runMultiModelReviewStream(
  task: string,
  codeSnippet?: string,
  repoContext?: string
): AsyncGenerator<ModelReview, void, void> {
  const mode = process.env.COPILOT_SDK_MODE || "mock";
  if (mode !== "live") {
    for (const review of runMockMultiModelReview(task, codeSnippet)) {
      yield review;
    }
    return;
  }

  const providers: Provider[] = ["gpt", "claude", "gemini"];
  type Settled = { provider: Provider; review: ModelReview };
  const pending = new Map<Provider, Promise<Settled>>();

  for (const provider of providers) {
    const prompt = buildReviewerPrompt(task, codeSnippet, repoContext, SLANTS[provider]);
    const p = RUNNERS[provider](prompt).then(
      (output) => ({ provider, review: toModelReview(provider, output) }),
      (err) => {
        console.error(`[Sooko Reviewers] ${provider} failed:`, err);
        return { provider, review: degradedReview(provider, errMsg(err)) };
      }
    );
    pending.set(provider, p);
  }

  while (pending.size > 0) {
    const winner = await Promise.race(pending.values());
    pending.delete(winner.provider);
    yield winner.review;
  }
}

/**
 * Collector wrapper — preserves the original synchronous-result API.
 * New code should prefer `runMultiModelReviewStream` for progressive UI.
 */
export async function runMultiModelReview(
  task: string,
  codeSnippet?: string,
  repoContext?: string
): Promise<ModelReview[]> {
  const reviews: ModelReview[] = [];
  for await (const r of runMultiModelReviewStream(task, codeSnippet, repoContext)) {
    reviews.push(r);
  }
  return reviews;
}

// ─── Mock mode (hackathon demo / offline) ────────────────────────────────────

function runMockMultiModelReview(task: string, codeSnippet?: string): ModelReview[] {
  void codeSnippet;
  const t = task.toLowerCase();
  const isAuth = t.includes("password") || t.includes("reset") || t.includes("auth");
  const isAPI = t.includes("api") || t.includes("endpoint");
  const isCheckout = t.includes("checkout") || t.includes("payment");

  return [
    {
      ...REVIEWER_META.gpt,
      verdict: "Needs Improvement",
      confidence: 72,
      bugs: [
        isAuth ? "Reset token not invalidated after successful password change" : "Missing null check on primary entity lookup",
        isAPI  ? "Response payload leaks internal field names"                  : "Race condition possible on concurrent state mutations",
      ],
      security: [
        isAuth ? "Rate limiting on reset endpoint is insufficient — allows 100 req/min" : "No input sanitization on user-supplied query parameters",
        "Missing CSRF token validation on state-changing operations",
        isCheckout ? "Payment amount not re-validated server-side before charge" : "Session fixation vulnerability in auth flow",
      ],
      tests: [
        isAuth ? "No test coverage for expired token redemption path" : "Missing integration test for error response format",
        "No load test for concurrent access patterns",
      ],
      edgeCases: [
        isAuth     ? "User requests multiple resets within a short window"            : "Empty string vs null handling inconsistent across endpoints",
        isCheckout ? "Cart modified between checkout initiation and payment capture" : "Unicode input in freeform fields not normalized",
      ],
      notes: "The implementation covers the happy path well but lacks defensive coding patterns needed for production. Security posture needs strengthening before deployment.",
    },
    {
      ...REVIEWER_META.claude,
      verdict: "Conditional Pass",
      confidence: 78,
      bugs: [
        isAuth ? "Password history check absent — user can reuse current password"   : "Error boundaries missing in critical render paths",
        isAPI  ? "Pagination cursor can be manipulated to access other users' data"  : "Stale closure in event handler causes inconsistent state",
      ],
      security: [
        isAuth ? "Reset token entropy is 32-bit — should be at least 128-bit" : "API keys stored in client-accessible configuration",
        "No Content-Security-Policy header configured",
      ],
      tests: [
        isAuth ? "Email delivery failure path entirely untested" : "No test for malformed request body handling",
        "Missing boundary value tests for numeric inputs",
        "No regression test for the identified race condition",
      ],
      edgeCases: [
        isAuth     ? "Account locked during password reset flow"       : "Request timeout handling during downstream service degradation",
        isCheckout ? "Applying discount code after price recalculation" : "Concurrent requests from same user session",
      ],
      notes: "Architecture is sound and follows reasonable patterns. Primary concerns are around token security and missing test coverage for failure scenarios. Recommend addressing security findings before merge.",
    },
    {
      ...REVIEWER_META.gemini,
      verdict: "Needs Improvement",
      confidence: 68,
      bugs: [
        isAuth ? "Email verification link does not expire independently of reset token" : "Memory leak in subscription handler — no cleanup on unmount",
        isAPI  ? "GraphQL query depth not limited — potential DoS vector"               : "Incorrect HTTP status codes returned for validation errors",
      ],
      security: [
        isAuth ? "Rate limiting not enforced at the user-identity level, only IP-based" : "SQL injection possible through unsanitized sort parameter",
        "Missing audit logging for sensitive operations",
        isCheckout ? "Order total calculated client-side without server verification" : "CORS configuration overly permissive for production",
      ],
      tests: [
        isAuth ? "No test for concurrent reset attempts from different devices" : "Integration test suite missing database transaction rollback",
        "Zero coverage on error handling middleware",
      ],
      edgeCases: [
        isAuth ? "User changes email address while reset is in flight" : "Timezone-dependent logic produces incorrect results near midnight UTC",
        "System behavior undefined when third-party service returns 503",
      ],
      notes: "The implementation needs additional hardening. While the core logic is functional, the security surface area is larger than it should be. Testing gaps around concurrency and failure modes are concerning for a production deployment.",
    },
  ];
}
