// ─── Core Domain Types ───────────────────────────────────────────────────────

export type Stage = "intake" | "planning" | "reviewing" | "consensus" | "report";

export interface Task {
  id: string;
  prompt: string;
  codeSnippet?: string;
  repoContext?: string;
  status: Stage;
  createdAt: string;
}

// ─── Plan ────────────────────────────────────────────────────────────────────

export interface PlanStep {
  id: number;
  title: string;
  description: string;
  status: "complete" | "in-progress" | "pending";
}

export interface ExecutionPlan {
  objective: string;
  steps: PlanStep[];
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export interface ReviewFinding {
  model: string;
  severity: "high" | "medium" | "low";
  category: "bug" | "security" | "test" | "edge-case";
  issue: string;
  recommendation?: string;
}

export interface ModelReview {
  reviewer: string;
  model: string;
  color: string;
  icon: string;
  verdict: "Pass" | "Conditional Pass" | "Needs Improvement" | "Fail";
  confidence: number;
  bugs: string[];
  security: string[];
  tests: string[];
  edgeCases: string[];
  notes: string;
}

// ─── Consensus ───────────────────────────────────────────────────────────────

export interface AgreedFinding {
  category: string;
  finding: string;
  reviewers: string[];
  severity: "high" | "medium" | "low";
}

export interface DisputedFinding {
  category: string;
  finding: string;
  reviewer: string;
  severity: "high" | "medium" | "low";
}

export interface ConsensusReport {
  agreed: AgreedFinding[];
  disputed: DisputedFinding[];
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
  totalFindings: number;
  securityCount: number;
  testGapCount: number;
  recommendation: string;
  rationale: string;
}

// ─── Analysis Result ─────────────────────────────────────────────────────────

export interface AnalysisResult {
  task: Task;
  plan: ExecutionPlan;
  reviews: ModelReview[];
  consensus: ConsensusReport;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface AnalyzeRequest {
  task: string;
  codeSnippet?: string;
  repoContext?: string;
}

export interface AnalyzeResponse {
  success: boolean;
  data?: AnalysisResult;
  error?: string;
}
