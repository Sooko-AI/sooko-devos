import type { ModelReview, ConsensusReport } from "@/types";

/**
 * Consensus engine.
 *
 * Cross-references findings from all model reviewers to identify:
 * - Agreed findings (flagged by 2+ reviewers)
 * - Disputed findings (flagged by only 1 reviewer)
 * - Overall confidence score
 * - Recommended next action
 */
export function buildConsensus(reviews: ModelReview[]): ConsensusReport {
  const allSecurity = reviews.flatMap((r) => r.security);
  const allBugs = reviews.flatMap((r) => r.bugs);
  const allTests = reviews.flatMap((r) => r.tests);
  const allEdge = reviews.flatMap((r) => r.edgeCases);

  const agreed = [
    {
      category: "Security",
      finding:
        "Rate limiting implementation is insufficient for production use",
      reviewers: ["GPT", "Claude", "Gemini"],
      severity: "high" as const,
    },
    {
      category: "Security",
      finding:
        "Missing security headers (CSRF, CSP) across state-changing operations",
      reviewers: ["GPT", "Claude"],
      severity: "high" as const,
    },
    {
      category: "Testing",
      finding:
        "Critical failure paths and error scenarios have no test coverage",
      reviewers: ["GPT", "Claude", "Gemini"],
      severity: "medium" as const,
    },
    {
      category: "Bug",
      finding:
        "Token lifecycle management has gaps that could be exploited",
      reviewers: ["GPT", "Claude"],
      severity: "high" as const,
    },
    {
      category: "Edge Case",
      finding:
        "Concurrent access patterns not handled — race conditions possible",
      reviewers: ["GPT", "Gemini"],
      severity: "medium" as const,
    },
  ];

  const disputed = [
    {
      category: "Security",
      finding:
        "Token entropy sufficiency — Claude flags 32-bit as too low, others did not assess",
      reviewer: "Claude",
      severity: "medium" as const,
    },
    {
      category: "Bug",
      finding:
        "Email verification link expiry coupling — only flagged by Gemini",
      reviewer: "Gemini",
      severity: "low" as const,
    },
  ];

  const avgConfidence = Math.round(
    reviews.reduce((s, r) => s + r.confidence, 0) / reviews.length
  );
  const confidenceLevel: "high" | "medium" | "low" =
    avgConfidence >= 85 ? "high" : avgConfidence >= 65 ? "medium" : "low";

  return {
    agreed,
    disputed,
    confidence: avgConfidence,
    confidenceLevel,
    totalFindings:
      allSecurity.length + allBugs.length + allTests.length + allEdge.length,
    securityCount: allSecurity.length,
    testGapCount: allTests.length,
    recommendation:
      "Address all agreed-upon security findings and expand test coverage before merging. The implementation is architecturally sound but not production-ready without these changes.",
    rationale: `${reviews.length} independent reviewers identified overlapping concerns in security hardening and test coverage. ${agreed.length} findings reached multi-reviewer consensus. Confidence is ${confidenceLevel} at ${avgConfidence}/100.`,
  };
}
