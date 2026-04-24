import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type {
  ModelReview,
  ConsensusReport,
  AgreedFinding,
  DisputedFinding,
} from "@/types";

// ─── Shared ──────────────────────────────────────────────────────────────────

const CATEGORIES: ReadonlyArray<{ key: "security" | "bugs" | "tests" | "edgeCases"; label: ClusterCategory }> = [
  { key: "security",  label: "Security"  },
  { key: "bugs",      label: "Bug"       },
  { key: "tests",     label: "Testing"   },
  { key: "edgeCases", label: "Edge Case" },
];

type ClusterCategory = "Security" | "Bug" | "Testing" | "Edge Case";
type Severity = "high" | "medium" | "low";

type Cluster = {
  category: ClusterCategory;
  finding: string;
  reviewers: string[];
  severity: Severity;
};

function shortReviewerName(reviewer: string): string {
  // "Security Auditor (GPT)" → "GPT"; "GPT Reviewer" → "GPT" (legacy)
  const paren = reviewer.match(/\(([^)]+)\)/);
  if (paren) return paren[1].trim();
  return reviewer.replace(/\s+Reviewer$/i, "").trim();
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// ─── Jaccard clustering (deterministic fallback) ─────────────────────────────

const SIM_THRESHOLD = 0.35;
const HIGH_SEVERITY_BUG = /injection|leak|race|auth|token|csrf|xss|rce|privilege|credential|bypass/i;
const STOPWORDS = new Set([
  "the","a","an","and","or","but","for","to","of","in","on","at","by","with",
  "is","are","was","were","be","been","being","has","have","had","do","does",
  "did","this","that","these","those","it","its","from","as","if","not","no",
]);

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return inter / union;
}

function severityForDeterministic(category: ClusterCategory, finding: string): Severity {
  if (category === "Security") return "high";
  if (category === "Bug") return HIGH_SEVERITY_BUG.test(finding) ? "high" : "medium";
  return "medium";
}

type Tagged = {
  reviewer: string;
  category: ClusterCategory;
  finding: string;
  tokens: Set<string>;
};

function collectFindings(reviews: ModelReview[]): Tagged[] {
  const all: Tagged[] = [];
  for (const r of reviews) {
    if (r.verdict === "Fail" && r.confidence === 0) continue; // skip degraded
    for (const { key, label } of CATEGORIES) {
      for (const finding of r[key]) {
        if (!finding?.trim()) continue;
        all.push({
          reviewer: shortReviewerName(r.reviewer),
          category: label,
          finding,
          tokens: tokenize(finding),
        });
      }
    }
  }
  return all;
}

function clusterFindingsJaccard(reviews: ModelReview[]): Cluster[] {
  const all = collectFindings(reviews);
  const clusters: Tagged[][] = [];
  for (const f of all) {
    let placed = false;
    for (const cluster of clusters) {
      const head = cluster[0];
      if (head.category !== f.category) continue;
      if (jaccard(head.tokens, f.tokens) >= SIM_THRESHOLD) {
        cluster.push(f);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([f]);
  }
  return clusters.map((c) => {
    const reviewers = Array.from(new Set(c.map((x) => x.reviewer)));
    const canonical = c.map((x) => x.finding).sort((a, b) => b.length - a.length)[0];
    const category = c[0].category;
    return {
      category,
      finding: canonical,
      reviewers,
      severity: severityForDeterministic(category, canonical),
    };
  });
}

// ─── LLM judge (primary in live mode) ────────────────────────────────────────

const JUDGE_TIMEOUT_MS = 20_000;
const JUDGE_MODEL = "claude-haiku-4-5";

const JudgeClusterSchema = z.object({
  category: z.enum(["Security", "Bug", "Testing", "Edge Case"]),
  finding: z.string(),
  reviewers: z.array(z.string()),
  severity: z.enum(["high", "medium", "low"]),
});
const JudgeOutputSchema = z.object({
  clusters: z.array(JudgeClusterSchema),
});

function buildJudgePrompt(reviews: ModelReview[]): string {
  const active = reviews.filter((r) => !(r.verdict === "Fail" && r.confidence === 0));
  let p = `You are a consensus judge. Three independent specialist reviewers examined the same software task. Your job: CLUSTER their findings — group together findings that describe the SAME UNDERLYING ISSUE even when phrasing differs. Preserve single-reviewer findings as single-member clusters.

Each cluster you emit must have:
- category: one of "Security" | "Bug" | "Testing" | "Edge Case"
- finding: a concise canonical statement of the issue (<= 25 words), neutral and specific
- reviewers: array of short reviewer names that raised this issue — use the short names in the headers below
- severity: "high" | "medium" | "low"

Severity guidance:
- Security issues are typically "high" unless narrowly scoped or defensive.
- Bugs are "high" if they allow data loss, auth bypass, corruption, or privilege escalation; otherwise "medium".
- Testing and Edge Case gaps are usually "medium" unless they protect against auth/data-integrity failures.

Clustering rules:
- Cluster aggressively: e.g. "BOLA/IDOR" and "No ownership check between authenticated user and /:id param" are the SAME issue.
- Cluster across categories when appropriate — a reviewer may have called a missing-test what another called a security gap; pick the most accurate category.
- Do not invent findings. Only cluster findings actually raised by a reviewer below.
- Do not drop single-reviewer findings — emit each as a cluster of size 1.
- One cluster per distinct underlying issue. No duplicates.

Reviewers and their findings:
`;
  for (const r of active) {
    const short = shortReviewerName(r.reviewer);
    p += `\n=== ${short} — ${r.reviewer} ===\n`;
    if (r.bugs.length)      p += `Bugs:\n${r.bugs.map((x) => `  - ${x}`).join("\n")}\n`;
    if (r.security.length)  p += `Security:\n${r.security.map((x) => `  - ${x}`).join("\n")}\n`;
    if (r.tests.length)     p += `Tests:\n${r.tests.map((x) => `  - ${x}`).join("\n")}\n`;
    if (r.edgeCases.length) p += `EdgeCases:\n${r.edgeCases.map((x) => `  - ${x}`).join("\n")}\n`;
  }
  p += `\nReturn ONLY JSON matching the required schema.`;
  return p;
}

async function clusterFindingsViaJudge(reviews: ModelReview[]): Promise<Cluster[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await withTimeout(
    client.messages.parse({
      model: JUDGE_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: buildJudgePrompt(reviews) }],
      output_config: { format: zodOutputFormat(JudgeOutputSchema) },
    }),
    JUDGE_TIMEOUT_MS,
    "Consensus Judge"
  );
  if (!message.parsed_output) throw new Error("Judge response missing parsed_output");
  return message.parsed_output.clusters;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function buildConsensus(reviews: ModelReview[]): Promise<ConsensusReport> {
  const mode = process.env.COPILOT_SDK_MODE || "mock";
  let clusters: Cluster[];

  if (mode === "live") {
    try {
      clusters = await clusterFindingsViaJudge(reviews);
      console.log(`[Sooko Consensus] LLM judge produced ${clusters.length} clusters`);
    } catch (err) {
      console.warn(
        "[Sooko Consensus] Judge failed, falling back to Jaccard clustering:",
        err instanceof Error ? err.message : err
      );
      clusters = clusterFindingsJaccard(reviews);
    }
  } else {
    clusters = clusterFindingsJaccard(reviews);
  }

  const agreed: AgreedFinding[] = [];
  const disputed: DisputedFinding[] = [];
  for (const c of clusters) {
    if (c.reviewers.length >= 2) {
      agreed.push({ ...c });
    } else {
      disputed.push({
        category: c.category,
        finding: c.finding,
        reviewer: c.reviewers[0] ?? "Unknown",
        severity: c.severity,
      });
    }
  }

  const sevRank = { high: 0, medium: 1, low: 2 } as const;
  agreed.sort(
    (a, b) => sevRank[a.severity] - sevRank[b.severity] || b.reviewers.length - a.reviewers.length
  );
  disputed.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);

  // Total-findings counts use the raw flat input so the "N security findings" stat
  // reflects effort across reviewers, not deduplicated clusters.
  const allFlat = collectFindings(reviews);
  const totalFindings = allFlat.length;
  const securityCount = allFlat.filter((f) => f.category === "Security").length;
  const testGapCount  = allFlat.filter((f) => f.category === "Testing").length;

  const activeReviews = reviews.filter((r) => !(r.verdict === "Fail" && r.confidence === 0));
  const avgConfidence = activeReviews.length
    ? Math.round(activeReviews.reduce((s, r) => s + r.confidence, 0) / activeReviews.length)
    : 0;
  const confidenceLevel: "high" | "medium" | "low" =
    avgConfidence >= 85 ? "high" : avgConfidence >= 65 ? "medium" : "low";

  const highSevAgreed = agreed.filter((a) => a.severity === "high").length;
  const recommendation =
    highSevAgreed > 0
      ? `Block merge: ${highSevAgreed} high-severity finding${highSevAgreed > 1 ? "s" : ""} reached multi-reviewer consensus. Address security and critical bugs before proceeding.`
      : agreed.length > 0
      ? `Conditional merge: ${agreed.length} finding${agreed.length > 1 ? "s" : ""} reached multi-reviewer consensus. Resolve before merging.`
      : `Low-risk: no multi-reviewer consensus findings. Review disputed items and proceed with standard review.`;

  const levelWord = confidenceLevel[0].toUpperCase() + confidenceLevel.slice(1);
  const rationale =
    `${activeReviews.length} reviewer${activeReviews.length === 1 ? "" : "s"} returned output; ` +
    `${agreed.length} finding${agreed.length === 1 ? "" : "s"} reached consensus across ≥2 reviewers, ` +
    `${disputed.length} were raised by a single reviewer. ` +
    `${levelWord} confidence at ${avgConfidence}/100.`;

  return {
    agreed,
    disputed,
    confidence: avgConfidence,
    confidenceLevel,
    totalFindings,
    securityCount,
    testGapCount,
    recommendation,
    rationale,
  };
}
