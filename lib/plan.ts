import type { ExecutionPlan } from "@/types";

/**
 * Generate a structured execution plan for a software task.
 * In mock mode, returns a realistic deterministic plan.
 * In live mode, this is called as a fallback if the SDK agent
 * doesn't return a structured plan.
 */
export function generatePlan(task: string): ExecutionPlan {
  return {
    objective: task,
    steps: [
      {
        id: 1,
        title: "Define Requirements",
        description:
          "Clarify functional and non-functional requirements, identify user stories, and define acceptance criteria for the implementation.",
        status: "complete",
      },
      {
        id: 2,
        title: "Design Architecture",
        description:
          "Map out system components, data flow, API contracts, and integration points. Identify dependencies and potential bottlenecks.",
        status: "complete",
      },
      {
        id: 3,
        title: "Implement Core Feature",
        description:
          "Build the primary logic, database schema, API routes, and frontend components according to the architectural design.",
        status: "complete",
      },
      {
        id: 4,
        title: "Add Validation & Security",
        description:
          "Implement input validation, authentication checks, rate limiting, CSRF protection, and other security hardening measures.",
        status: "complete",
      },
      {
        id: 5,
        title: "Write Tests",
        description:
          "Create unit tests, integration tests, and edge case coverage. Ensure all critical paths are tested with appropriate assertions.",
        status: "complete",
      },
      {
        id: 6,
        title: "Prepare Rollout",
        description:
          "Document changes, write migration scripts, set up feature flags, and prepare monitoring and rollback procedures.",
        status: "pending",
      },
    ],
  };
}
