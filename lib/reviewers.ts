import type { ModelReview } from "@/types";

/**
 * Multi-model review engine.
 *
 * In live mode (with Copilot SDK BYOK), each reviewer calls a different
 * model provider. In mock mode, returns realistic deterministic outputs
 * that vary by reviewer to demonstrate consensus/contradiction detection.
 */
export function runMultiModelReview(
  task: string,
  codeSnippet?: string
): ModelReview[] {
  const t = task.toLowerCase();
  const isAuth =
    t.includes("password") || t.includes("reset") || t.includes("auth");
  const isAPI = t.includes("api") || t.includes("endpoint");
  const isCheckout = t.includes("checkout") || t.includes("payment");

  return [
    buildGptReview(task, isAuth, isAPI, isCheckout),
    buildClaudeReview(task, isAuth, isAPI, isCheckout),
    buildGeminiReview(task, isAuth, isAPI, isCheckout),
  ];
}

function buildGptReview(
  task: string,
  isAuth: boolean,
  isAPI: boolean,
  isCheckout: boolean
): ModelReview {
  return {
    reviewer: "GPT Reviewer",
    model: "gpt-4o",
    color: "#10b981",
    icon: "G",
    verdict: "Needs Improvement",
    confidence: 72,
    bugs: [
      isAuth
        ? "Reset token not invalidated after successful password change"
        : "Missing null check on primary entity lookup",
      isAPI
        ? "Response payload leaks internal field names"
        : "Race condition possible on concurrent state mutations",
    ],
    security: [
      isAuth
        ? "Rate limiting on reset endpoint is insufficient — allows 100 req/min"
        : "No input sanitization on user-supplied query parameters",
      "Missing CSRF token validation on state-changing operations",
      isCheckout
        ? "Payment amount not re-validated server-side before charge"
        : "Session fixation vulnerability in auth flow",
    ],
    tests: [
      isAuth
        ? "No test coverage for expired token redemption path"
        : "Missing integration test for error response format",
      "No load test for concurrent access patterns",
    ],
    edgeCases: [
      isAuth
        ? "User requests multiple resets within a short window"
        : "Empty string vs null handling inconsistent across endpoints",
      isCheckout
        ? "Cart modified between checkout initiation and payment capture"
        : "Unicode input in freeform fields not normalized",
    ],
    notes:
      "The implementation covers the happy path well but lacks defensive coding patterns needed for production. Security posture needs strengthening before deployment.",
  };
}

function buildClaudeReview(
  task: string,
  isAuth: boolean,
  isAPI: boolean,
  isCheckout: boolean
): ModelReview {
  return {
    reviewer: "Claude Reviewer",
    model: "claude-sonnet-4",
    color: "#d97706",
    icon: "C",
    verdict: "Conditional Pass",
    confidence: 78,
    bugs: [
      isAuth
        ? "Password history check absent — user can reuse current password"
        : "Error boundaries missing in critical render paths",
      isAPI
        ? "Pagination cursor can be manipulated to access other users' data"
        : "Stale closure in event handler causes inconsistent state",
    ],
    security: [
      isAuth
        ? "Reset token entropy is 32-bit — should be at least 128-bit"
        : "API keys stored in client-accessible configuration",
      "No Content-Security-Policy header configured",
    ],
    tests: [
      isAuth
        ? "Email delivery failure path entirely untested"
        : "No test for malformed request body handling",
      "Missing boundary value tests for numeric inputs",
      "No regression test for the identified race condition",
    ],
    edgeCases: [
      isAuth
        ? "Account locked during password reset flow"
        : "Request timeout handling during downstream service degradation",
      isCheckout
        ? "Applying discount code after price recalculation"
        : "Concurrent requests from same user session",
    ],
    notes:
      "Architecture is sound and follows reasonable patterns. Primary concerns are around token security and missing test coverage for failure scenarios. Recommend addressing security findings before merge.",
  };
}

function buildGeminiReview(
  task: string,
  isAuth: boolean,
  isAPI: boolean,
  isCheckout: boolean
): ModelReview {
  return {
    reviewer: "Gemini Reviewer",
    model: "gemini-2.5-pro",
    color: "#6366f1",
    icon: "Ge",
    verdict: "Needs Improvement",
    confidence: 68,
    bugs: [
      isAuth
        ? "Email verification link does not expire independently of reset token"
        : "Memory leak in subscription handler — no cleanup on unmount",
      isAPI
        ? "GraphQL query depth not limited — potential DoS vector"
        : "Incorrect HTTP status codes returned for validation errors",
    ],
    security: [
      isAuth
        ? "Rate limiting not enforced at the user-identity level, only IP-based"
        : "SQL injection possible through unsanitized sort parameter",
      "Missing audit logging for sensitive operations",
      isCheckout
        ? "Order total calculated client-side without server verification"
        : "CORS configuration overly permissive for production",
    ],
    tests: [
      isAuth
        ? "No test for concurrent reset attempts from different devices"
        : "Integration test suite missing database transaction rollback",
      "Zero coverage on error handling middleware",
    ],
    edgeCases: [
      isAuth
        ? "User changes email address while reset is in flight"
        : "Timezone-dependent logic produces incorrect results near midnight UTC",
      "System behavior undefined when third-party service returns 503",
    ],
    notes:
      "The implementation needs additional hardening. While the core logic is functional, the security surface area is larger than it should be. Testing gaps around concurrency and failure modes are concerning for a production deployment.",
  };
}
