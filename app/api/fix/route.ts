import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { FixSchema, type FixOutput } from "@/lib/schemas";
import type { AgreedFinding, DisputedFinding } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FixRequest;
    if (!body.task?.trim()) {
      return NextResponse.json(
        { success: false, error: "Task is required" } as FixResponse,
        { status: 400 }
      );
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OPENAI_API_KEY is not configured" } as FixResponse,
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.parse({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: buildPrompt(body) },
      ],
      response_format: zodResponseFormat(FixSchema, "FixPlan"),
    });
    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) throw new Error("OpenAI response missing parsed output");

    return NextResponse.json({ success: true, data: parsed } as FixResponse);
  } catch (error) {
    console.error("[Sooko API] Fix generation failed:", error);
    const message =
      process.env.NODE_ENV === "production"
        ? "Fix generation failed. Please try again."
        : error instanceof Error
        ? `Fix generation failed: ${error.message}`
        : "Fix generation failed.";
    return NextResponse.json(
      { success: false, error: message } as FixResponse,
      { status: 500 }
    );
  }
}
