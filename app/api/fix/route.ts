import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { FixSchema, type FixOutput } from "@/lib/schemas";
import type { AgreedFinding, DisputedFinding } from "@/types";
import { checkRateLimit, getClientKey, sweepIfDue, FIX_LIMIT } from "@/lib/ratelimit";
import { withTimeout, withRetry, errMsg } from "@/lib/async";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 96 * 1024;
const MAX_TASK_CHARS = 4_000;
const MAX_CODE_CHARS = 30_000;
const MAX_FINDINGS = 60;
const FIX_TIMEOUT_MS = 45_000;

interface FixRequest {
  task: string;
  codeSnippet?: string;
  agreed: AgreedFinding[];
  disputed: DisputedFinding[];
}

interface FixResponse {
  success: boolean;
  data?: FixOutput;
  error?: string;
}

const SYSTEM = `You are the Sooko DevOS remediation agent.
Given a software task, optional code, and a set of findings from a multi-model review, produce a precise set of fixes.

Return JSON matching the required schema:
- summary: 1-2 sentence overview of the remediation approach.
- fixes: one entry per finding you address. Each entry has:
    - finding: the original finding text (verbatim or lightly paraphrased).
    - severity: "high" | "medium" | "low" (inherit from the input where given).
    - remediation: concrete steps to resolve it — specific, not generic.
    - codeChange: a short code snippet illustrating the fix. Empty string if not applicable.
- patchedCode: full revised code with all fixes applied, if code was provided. Empty string otherwise.

Rules:
- Prioritize high-severity findings first.
- If the same root cause appears across findings, deduplicate into one fix entry.
- Be specific and actionable — no hand-waving.
- Return ONLY JSON. No prose, no markdown fences.`;

function buildPrompt(body: FixRequest): string {
  let p = `Task: ${body.task}`;
  if (body.codeSnippet) p += `\n\nOriginal code:\n\`\`\`\n${body.codeSnippet}\n\`\`\``;
  if (body.agreed.length) {
    p += `\n\nAgreed findings (multi-reviewer consensus):\n`;
    p += body.agreed.map((f, i) => `${i + 1}. [${f.severity}] [${f.category}] ${f.finding} — agreed by ${f.reviewers.join(", ")}`).join("\n");
  }
  if (body.disputed.length) {
    p += `\n\nDisputed findings (single-reviewer):\n`;
    p += body.disputed.map((f, i) => `${i + 1}. [${f.severity}] [${f.category}] ${f.finding} — raised by ${f.reviewer}`).join("\n");
  }
  p += `\n\nProduce a structured set of fixes.`;
  return p;
}

let _openai: OpenAI | null = null;
function openaiClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ success: false, error: message } as FixResponse, { status, headers });
}

export async function POST(request: NextRequest) {
  sweepIfDue();
  const rate = checkRateLimit(getClientKey(request), FIX_LIMIT);
  if (!rate.ok) {
    return jsonError("Rate limit exceeded. Please slow down.", 429, {
      "Retry-After": String(rate.retryAfterSec),
    });
  }

  const cl = Number(request.headers.get("content-length") ?? 0);
  if (cl && cl > MAX_BODY_BYTES) {
    return jsonError(`Request body too large (max ${MAX_BODY_BYTES} bytes).`, 413);
  }

  let body: FixRequest;
  try {
    body = (await request.json()) as FixRequest;
  } catch {
    return jsonError("Request body is not valid JSON.", 400);
  }

  if (!body.task?.trim()) return jsonError("Task is required", 400);
  if (body.task.length > MAX_TASK_CHARS) return jsonError(`Task too long (max ${MAX_TASK_CHARS} chars).`, 413);
  if (body.codeSnippet && body.codeSnippet.length > MAX_CODE_CHARS) {
    return jsonError(`Code snippet too long (max ${MAX_CODE_CHARS} chars).`, 413);
  }
  const findingCount = (body.agreed?.length ?? 0) + (body.disputed?.length ?? 0);
  if (findingCount > MAX_FINDINGS) {
    return jsonError(`Too many findings (max ${MAX_FINDINGS}).`, 413);
  }
  if (!process.env.OPENAI_API_KEY) {
    return jsonError("OPENAI_API_KEY is not configured", 500);
  }

  // Bridge client-disconnect to the OpenAI call.
  const ac = new AbortController();
  const onClientAbort = () => ac.abort();
  request.signal.addEventListener("abort", onClientAbort, { once: true });

  try {
    const parsed = await withRetry(
      async () => {
        const completion = await withTimeout(
          openaiClient().chat.completions.parse(
            {
              model: "gpt-4o",
              messages: [
                { role: "system", content: SYSTEM },
                { role: "user", content: buildPrompt(body) },
              ],
              response_format: zodResponseFormat(FixSchema, "FixPlan"),
            },
            { signal: ac.signal }
          ),
          FIX_TIMEOUT_MS,
          "OpenAI fix",
          ac.signal
        );
        const out = completion.choices[0]?.message?.parsed;
        if (!out) throw new Error("OpenAI response missing parsed output");
        return out;
      },
      { label: "openai-fix", signal: ac.signal }
    );
    return NextResponse.json({ success: true, data: parsed } as FixResponse);
  } catch (error) {
    if (ac.signal.aborted) {
      return jsonError("Request canceled.", 499);
    }
    console.error("[Sooko API] Fix generation failed:", errMsg(error));
    const message =
      process.env.NODE_ENV === "production"
        ? "Fix generation failed. Please try again."
        : `Fix generation failed: ${errMsg(error)}`;
    return jsonError(message, 500);
  } finally {
    request.signal.removeEventListener("abort", onClientAbort);
  }
}
