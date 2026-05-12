import { NextRequest } from "next/server";
import { runAgentWorkflowStream, type AnalyzeEvent } from "@/lib/agent";
import type { AnalyzeRequest } from "@/types";
import { checkRateLimit, getClientKey, sweepIfDue, ANALYZE_LIMIT } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 64 * 1024;        // 64KB total
const MAX_TASK_CHARS = 4_000;
const MAX_CODE_CHARS = 30_000;
const MAX_REPO_CHARS = 4_000;

function sseResponse(stream: ReadableStream, extraHeaders?: HeadersInit): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // Nginx/Vercel edge: disable response buffering so events flush immediately.
      "X-Accel-Buffering": "no",
      ...extraHeaders,
    },
  });
}

function sseError(message: string, status = 400, extraHeaders?: HeadersInit): Response {
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
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export async function POST(request: NextRequest) {
  sweepIfDue();
  const rate = checkRateLimit(getClientKey(request), ANALYZE_LIMIT);
  if (!rate.ok) {
    return sseError("Rate limit exceeded. Please slow down.", 429, {
      "Retry-After": String(rate.retryAfterSec),
    });
  }

  const cl = Number(request.headers.get("content-length") ?? 0);
  if (cl && cl > MAX_BODY_BYTES) {
    return sseError(`Request body too large (max ${MAX_BODY_BYTES} bytes).`, 413);
  }

  let body: AnalyzeRequest;
  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return sseError("Request body is not valid JSON.", 400);
  }

  if (!body.task?.trim()) {
    return sseError("Task description is required.", 400);
  }
  if (body.task.length > MAX_TASK_CHARS) {
    return sseError(`Task too long (max ${MAX_TASK_CHARS} chars).`, 413);
  }
  if (body.codeSnippet && body.codeSnippet.length > MAX_CODE_CHARS) {
    return sseError(`Code snippet too long (max ${MAX_CODE_CHARS} chars).`, 413);
  }
  if (body.repoContext && body.repoContext.length > MAX_REPO_CHARS) {
    return sseError(`Repo context too long (max ${MAX_REPO_CHARS} chars).`, 413);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Forward client disconnects to the workflow so in-flight LLM calls
      // can abort and we stop spending tokens on an orphaned request.
      const ac = new AbortController();
      const onClientAbort = () => ac.abort();
      request.signal.addEventListener("abort", onClientAbort, { once: true });

      const send = (event: AnalyzeEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of runAgentWorkflowStream(
          body.task,
          body.codeSnippet,
          body.repoContext,
          ac.signal
        )) {
          send(event);
        }
      } catch (err) {
        // Client disconnect surfaces as an abort — no need to write an error event.
        if (ac.signal.aborted) {
          console.log("[Sooko API] Client disconnected, stream aborted.");
        } else {
          console.error("[Sooko API] Analysis stream failed:", err instanceof Error ? err.message : err);
          const message =
            process.env.NODE_ENV === "production"
              ? "Analysis failed. Please try again."
              : err instanceof Error
              ? `Analysis failed: ${err.message}`
              : "Analysis failed.";
          send({ type: "error", error: message });
        }
      } finally {
        request.signal.removeEventListener("abort", onClientAbort);
        controller.close();
      }
    },
  });

  return sseResponse(stream, { "X-RateLimit-Remaining": String(rate.remaining) });
}
