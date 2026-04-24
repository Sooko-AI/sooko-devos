# Feedback — Sooko DevOS (Sooko AI)

## Team

**Sooko AI** — building the trust layer for AI-generated software work.

## What We Built

Sooko DevOS is a Copilot SDK-powered agent that plans, reviews, validates, and summarizes software tasks using multi-model intelligence. It takes a user's software task, generates a structured execution plan, runs independent reviews across GPT-4o, Claude Sonnet 4, and Gemini 2.5 Pro, builds consensus across findings, and produces a confidence-scored final report.

## SDK Experience

### What worked well

- The SDK's BYOK (Bring Your Own Key) support made it straightforward to route reviews to different model providers, which is core to our multi-model architecture.
- The JSON-RPC architecture kept the integration clean — we could define agent instructions and tools without managing complex orchestration ourselves.
- Documentation was clear enough to get a working integration within the hackathon timeframe.
- The Node.js SDK being bundled with the CLI simplified setup significantly.

### Areas for improvement

- More examples of multi-tool agent workflows would help — most cookbook examples show single-tool usage. For products like ours that chain multiple agent steps (plan → review → consensus → report), more end-to-end examples would be valuable.
- Better documentation on how to handle structured JSON output from the agent. We spent time parsing responses that could have been more predictable with a response schema option.
- TypeScript types for the SDK response objects could be more comprehensive — we wrote our own type definitions for several response shapes.

### Feature requests

- A built-in way to run the same prompt across multiple BYOK providers in parallel and collect structured results would be powerful for multi-model comparison use cases.
- Support for streaming partial results during long agent runs would improve the UX for products that show progressive output.

## APM

We used `apm.yml` to declare our agent skills, tools, and SDK dependency. The manifest format was intuitive and we found it useful for documenting our agent architecture.

## Overall

The Copilot SDK is a strong foundation for building agentic products. The BYOK capability in particular unlocks multi-model architectures that aren't easy to build from scratch. We're excited about where this goes.
