# Sooko DevOS

### Copilot generates. Sooko decides.

*From AI output → to decision-ready software work.*

[![Built with Copilot SDK](https://img.shields.io/badge/Built_with-GitHub_Copilot_SDK-6f42c1?style=for-the-badge&logo=github)](https://github.com/github/copilot-sdk)
[![Web Summit 2026](https://img.shields.io/badge/Web_Summit-Vancouver_2026-000?style=for-the-badge)](https://vancouver.websummit.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)

---

## What is Sooko DevOS?

Sooko DevOS is a **Copilot SDK-powered agent** that transforms a software task into a confidence-scored, decision-ready report.

Instead of trusting a single model's output, Sooko runs a four-stage pipeline: it plans execution via the Copilot SDK, fans the task out to three specialist model reviewers in parallel, clusters their findings via an LLM judge for real semantic consensus, and generates a patched fixed version from the agreed findings.

### The Problem

AI can generate code quickly, but teams still spend significant time manually verifying correctness, security, and completeness. A single-model review is inconsistent and hard to trust.

### The Solution

An agentic trust layer powered by the GitHub Copilot SDK:

1. **Plans** a structured execution sequence (Copilot SDK session → `gpt-4.1`)
2. **Reviews** the task independently across three specialist reviewers — security, architecture, quality — each with a differentiated system prompt
3. **Builds consensus** via an LLM judge that clusters findings semantically, so "BOLA/IDOR" and "missing ownership check" count as the same issue
4. **Generates a Fixed Version** — per-finding remediations plus an optional patched-code block

Results stream to the UI over **Server-Sent Events**: plan, then each reviewer as it settles, then consensus, then done — no artificial delays.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser UI                                │
│              Next.js 14 App Router · Tailwind · TS               │
│         Streaming SSE reader (progressive card reveal)           │
└──────────────────────────┬──────────────────────────────────────┘
                           │   POST /api/analyze   (Server-Sent Events)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                runAgentWorkflowStream  (async generator)         │
│                                                                  │
│  [1] Plan  ──►  Copilot SDK session  (gpt-4.1)                   │
│                 └─ fallback: OpenAI gpt-4o direct                │
│                 └─ fallback: templated plan                      │
│                                                                  │
│  [2] Reviewers  ──►  Promise.race  (stream as each settles)      │
│         ├─ Security Auditor     (gpt-4o, security lens)          │
│         ├─ Architecture Reviewer (claude-sonnet-4-6, arch lens)  │
│         └─ Quality Reviewer     (gemini-2.5-pro, test/edge lens) │
│                                                                  │
│  [3] Consensus  ──►  LLM Judge (claude-haiku-4-5)                │
│                 └─ fallback: Jaccard similarity clusterer        │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│          Final Report + Export PDF + Generate Fixed Version      │
│                                                                  │
│   Agreed / Disputed findings · Severity · Confidence 0-100       │
│   Recommended action · Printable PDF · Patched code (POST /fix)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4-Stage Pipeline

```
User task → Plan → Multi-Model Review → Consensus → Report + Fix
```

| Stage | What happens |
|-------|-------------|
| **Intake**       | User describes a task, optionally pastes code. Four sample chips one-click populate the prompt. |
| **Plan**         | Copilot SDK agent session emits a 5–6 step structured plan (`gpt-4.1`). Falls back through OpenAI → templated. |
| **Review**       | Three specialists run in parallel with different system prompts. Each returns structured JSON (`bugs`, `security`, `tests`, `edgeCases`, `verdict`, `confidence`). |
| **Consensus**    | LLM judge clusters findings across reviewers semantically. Split into agreed (≥2 reviewers) vs disputed. Confidence is the mean reviewer confidence. |
| **Report**       | Final card with confidence gauge, findings by category, recommended action. |
| **Fix** (opt-in) | `Generate Fixed Version` button POSTs consensus to `/api/fix`, which returns per-finding remediations + optional patched code. |

---

## Features

- **Copilot SDK-powered planning** — a real `CopilotClient` session with `sendAndWait`, not a wrapper.
- **Three specialist reviewers** — security, architecture, quality — each with a distinct system prompt and emphasis.
- **LLM-judge consensus** — Claude Haiku clusters findings semantically; Jaccard fallback when judge unavailable.
- **Real SSE streaming** — plan arrives in ~5–10 s, reviewers stream in one at a time as each provider settles, consensus follows, then done.
- **Structured output everywhere** — `zodResponseFormat` (OpenAI), `zodOutputFormat` (Anthropic), `responseJsonSchema` (Google) — no prose-parsing.
- **Export PDF** — `window.print()` + tuned `@media print` stylesheet hides chrome and inverts colors for clean prints.
- **Generate Fixed Version** — separate `/api/fix` endpoint, OpenAI structured output, renders per-finding remediations + optional patched code inline.
- **Graceful degradation** — any provider failure produces a degraded `ModelReview` (verdict: "Fail", notes: "Provider unavailable"); the UI still renders, the stream still completes.

---

## Demo Flow

1. Click one of the four sample chips under the prompt (e.g. **API security audit**).
2. Plan card streams in first — five task-specific steps.
3. Three specialist review cards pop in one at a time as their providers settle (race order varies run-to-run).
4. Consensus panel appears, showing agreed and disputed findings clustered by the LLM judge.
5. Final report renders with confidence gauge, security concerns, test gaps, and recommended action derived from the real findings.
6. Click **Export PDF** to save a clean deliverable, or **Generate Fixed Version** to get structured remediations from the consensus set.

---

## Getting Started

### Prerequisites

- **Node.js 22.5+** — required by the `@github/copilot` CLI bundled with `@github/copilot-sdk` (it imports `node:sqlite`, added in Node 22.5). A `.nvmrc` is included, so `nvm use` picks the correct version.
- **pnpm** — used by this repo (`pnpm-lock.yaml` is committed).
- For **live mode**: GitHub Copilot authenticated locally *plus* three BYOK API keys (OpenAI, Anthropic, Google AI).

### Installation

```bash
git clone https://github.com/sooko-ai/sooko-devos.git
cd sooko-devos
nvm use          # picks up Node 22 from .nvmrc
pnpm install
```

### Configuration

Copy `.env.example` to `.env.local` and fill in values:

```env
# "mock" (default, no keys needed) or "live" (real Copilot SDK + multi-model review)
COPILOT_SDK_MODE=mock

# Required for live mode
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
```

### Run

```bash
nvm use          # only needed once per shell session
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The app runs fully in **mock mode** by default — no API keys required. Set `COPILOT_SDK_MODE=live` with all three BYOK keys to activate the real pipeline. On Node < 22.5 the Copilot SDK tier fails with `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` and the planner falls back to OpenAI direct — reviewers and the judge still run live.

---

## Project Structure

```
sooko-devos/
├── app/
│   ├── layout.tsx              # Root layout with fonts
│   ├── page.tsx                # Main page — SSE reader, stage state machine
│   ├── globals.css             # Global styles + @media print rules
│   └── api/
│       ├── analyze/
│       │   └── route.ts        # SSE endpoint — streams the pipeline
│       └── fix/
│           └── route.ts        # Generate Fixed Version endpoint
├── components/
│   ├── Navbar.tsx              # Top bar with reset
│   ├── Hero.tsx                # Landing hero + task input + sample chips
│   ├── Timeline.tsx            # Stage progress indicator
│   ├── PlanView.tsx            # Execution plan display
│   ├── ReviewCards.tsx         # Per-reviewer cards (progressive reveal)
│   ├── ConsensusPanel.tsx      # Agreed + disputed findings + confidence bar
│   ├── FinalReport.tsx         # Final card, PDF + fix buttons, fix panel
│   ├── LoadingState.tsx        # Loading indicator per stage
│   └── ui/
│       ├── Badge.tsx           # Badge / severity badge
│       └── Card.tsx            # Card container
├── lib/
│   ├── agent.ts                # Async-generator orchestrator + plan tiers
│   ├── reviewers.ts            # Specialist prompts + streaming fan-out
│   ├── consensus.ts            # LLM judge + Jaccard clustering
│   ├── plan.ts                 # Templated plan (final fallback)
│   ├── schemas.ts              # Shared zod schemas (review, plan, fix)
│   └── utils.ts                # cn, formatDate, delay
├── types/
│   └── index.ts                # TypeScript type definitions
├── AGENTS.md                   # Agent specification
├── apm.yml                     # APM manifest
├── .env.example
├── .nvmrc                      # Pins Node 22
├── package.json                # "engines": { "node": ">=22.5.0" }
├── tailwind.config.ts
├── tsconfig.json
└── next.config.js
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (target: ES2020) |
| Styling | Tailwind CSS + print stylesheet |
| Streaming | Server-Sent Events (`text/event-stream`) |
| Agent runtime | GitHub Copilot SDK (`@github/copilot-sdk@^0.2.2`) |
| Planner model | `gpt-4.1` via Copilot SDK · `gpt-4o` direct fallback |
| Reviewer models | `gpt-4o` · `claude-sonnet-4-6` · `gemini-2.5-pro` |
| Judge model | `claude-haiku-4-5` (consensus clustering) |
| Fix model | `gpt-4o` (structured output via `zodResponseFormat`) |
| Icons | `lucide-react` |

---

## Copilot SDK Integration

The Copilot SDK is the authoritative planner. See `lib/agent.ts:generatePlanViaSDK`:

- `new CopilotClient()` spawns the bundled `@github/copilot` CLI via JSON-RPC.
- `client.createSession({ model: "gpt-4.1", onPermissionRequest: approveAll, systemMessage: { mode: "replace", content: AGENT_INSTRUCTIONS } })` opens a session.
- `session.sendAndWait({ prompt }, 45_000)` blocks on `session.idle` and returns the assistant message.
- The response is parsed via `PlanSchema` (zod) and returned as a typed `ExecutionPlan`.
- `session.disconnect()` and `client.stop()` run in a `finally` so no orphan CLI processes linger.

If the SDK tier fails (missing Copilot auth, wrong Node version, model unavailable), the planner transparently falls through to direct OpenAI, and then to a templated plan. See [AGENTS.md](./AGENTS.md) for the full agent specification.

---

## Hackathon Submission

**Event**: Web Summit Vancouver 2026 — GitHub Copilot SDK Hackathon
**Theme**: "Build an agent into any app"
**Track**: End-to-end scenario

### Submission Checklist

- [x] Working solution in GitHub repo
- [x] README with architecture diagram and setup instructions
- [x] AGENTS.md with agent specification
- [x] apm.yml manifest
- [x] Feedback PR file (see `/feedback/`)
- [ ] 2-slide pitch deck
- [ ] 3-minute demo video
- [ ] 150-word submission summary

---

## Vision

**Today**: Trust layer for AI-generated code.
**Tomorrow**: Trust layer for AI-powered decisions across the enterprise.

*Copilot generates. Sooko decides.*

---

## License

MIT

---

*Built by [Sooko AI](https://sooko.ai) for Web Summit Vancouver 2026*
