import { NextRequest } from "next/server";
import { runAgentWorkflowStream, type AnalyzeEvent } from "@/lib/agent";
import type { AnalyzeRequest } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // Nginx/Vercel edge: disable response buffering so events flush immediately.
      "X-Accel-Buffering": "no",
    },
  });
}

function sseError(message: string, status = 400): Response {
  const encoder = new TextEncoder();
  const event: AnalyzeEvent = { type: "error", error: message };
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { "Content-Type": "text/event-stream; charset=utf-8" },
  });
}

export async function POST(request: NextRequest) {
  let body: AnalyzeRequest;
  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return sseError("Request body is not valid JSON.", 400);
  }

  if (!body.task?.trim()) {
    return sseError("Task description is required.", 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AnalyzeEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of runAgentWorkflowStream(
          body.task,
          body.codeSnippet,
          body.repoContext
        )) {
          send(event);
        }
      } catch (err) {
        console.error("[Sooko API] Analysis stream failed:", err);
        const message =
          process.env.NODE_ENV === "production"
            ? "Analysis failed. Please try again."
            : err instanceof Error
            ? `Analysis failed: ${err.message}`
            : "Analysis failed.";
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
