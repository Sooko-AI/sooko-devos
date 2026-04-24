import { NextRequest, NextResponse } from "next/server";
import { runAgentWorkflow } from "@/lib/agent";
import type { AnalyzeRequest, AnalyzeResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();

    if (!body.task?.trim()) {
      return NextResponse.json(
        { success: false, error: "Task description is required" } as AnalyzeResponse,
        { status: 400 }
      );
    }

    const result = await runAgentWorkflow(
      body.task,
      body.codeSnippet,
      body.repoContext
    );

    return NextResponse.json({
      success: true,
      data: result,
    } as AnalyzeResponse);
  } catch (error) {
    console.error("[Sooko API] Analysis failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Analysis failed. Please try again.",
      } as AnalyzeResponse,
      { status: 500 }
    );
  }
}
