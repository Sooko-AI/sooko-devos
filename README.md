# Sooko DevOS

### Copilot generates. Sooko decides.

*From AI output → to decision-ready software work.*

[![Built with Copilot SDK](https://img.shields.io/badge/Built_with-GitHub_Copilot_SDK-6f42c1?style=for-the-badge&logo=github)](https://github.com/github/copilot-sdk)
[![Web Summit 2026](https://img.shields.io/badge/Web_Summit-Vancouver_2026-000?style=for-the-badge)](https://vancouver.websummit.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)

---

## What is Sooko DevOS?

Sooko DevOS is a **Copilot SDK-powered agent** that transforms AI-generated code into verified, decision-ready output.

Instead of relying on a single model's output, Sooko DevOS runs a full agentic pipeline: it plans execution, generates code, reviews across multiple AI models, builds consensus, produces a confidence-scored report, and generates a fixed version.

### The Problem

AI can generate code quickly, but teams still spend significant time manually verifying correctness, security, and completeness. Single-model outputs are inconsistent and hard to trust.

### The Solution

An agentic trust layer powered by the GitHub Copilot SDK:

1. **Plans** a structured execution sequence
2. **Generates** an implementation artifact via the SDK agent runtime
3. **Reviews** code independently across GPT-4o, Claude Sonnet 4, and Gemini 2.5 Pro
4. **Builds consensus** — "3 models agree on 3 critical risks"
5. **Scores confidence** — quantified trust metric (0–100) with interpretation
6. **Generates a fixed version** — patched code from consensus findings (72 → 89)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                           │
│              Next.js 14 · Tailwind CSS · TypeScript              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Route Layer                              │
│                    /api/analyze                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                Copilot SDK Agent Runtime                         │
│                                                                  │
│   ┌────────┐  ┌────────┐  ┌──────────┐  ┌───────────┐          │
│   │  Plan  │→ │ Code   │→ │  Multi-  │→ │ Consensus │          │
│   │        │  │  Gen   │  │  Model   │  │  Engine   │          │
│   │        │  │        │  │  Review  │  │           │          │
│   └────────┘  └────────┘  └──────────┘  └───────────┘          │
│                                │                                 │
│                  ┌─────────────┼─────────────┐                   │
│                  ▼             ▼             ▼                   │
│            ┌──────────┐ ┌──────────┐ ┌─────────────┐            │
│            │  GPT-4o  │ │  Claude  │ │ Gemini 2.5  │            │
│            │ Reviewer │ │ Reviewer │ │ Pro Reviewer │            │
│            └──────────┘ └──────────┘ └─────────────┘            │
│               (BYOK)       (BYOK)        (BYOK)                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Final Report + Fix                           │
│                                                                  │
│   Agreed Findings · Disputed Findings · Confidence Score         │
│   Security Concerns · Test Gaps · Recommended Action             │
│   Generate Fixed Version (72 → 89 confidence improvement)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7-Stage Agent Pipeline

```
User Input → Copilot SDK Agent → Plan → Code Generation → Multi-Model Review → Consensus Engine → Report + Fix
```

| Stage | What Happens |
|-------|-------------|
| **Intake** | User describes a software task, optionally pastes code |
| **Plan** | Agent decomposes task into 6 structured execution steps |
| **Code Generation** | Agent produces implementation artifact with diff view |
| **Multi-Model Review** | GPT-4o, Claude Sonnet 4, Gemini 2.5 Pro independently review |
| **Consensus** | Cross-reference findings: agreed, disputed, confidence scored |
| **Report** | Final deliverable with confidence gauge and recommendations |
| **Fix** | Auto-generated patched version from consensus findings |

---

## Features

- **Copilot SDK agentic workflow** — real agent runtime, not a wrapper
- **Multi-model code review** — GPT-4o, Claude Sonnet 4, Gemini 2.5 Pro via BYOK
- **Consensus intelligence** — "3 models agree on 3 critical risks"
- **Confidence scoring** — radial gauge with interpretation (Safe to ship / Proceed with caution / High risk)
- **Code diff panel** — generated implementation with line-level annotations
- **Generate Fixed Version** — auto-patched code with confidence improvement (72 → 89)
- **Final implementation report** — exportable, audit-friendly summary
- **Stage completion feedback** — visual progress through the 7-stage pipeline

---

## Demo Flow

1. Enter a software task (e.g., "Build a password reset flow with rate limiting")
2. Watch the 7-stage pipeline execute with stage completion flashes
3. Review the generated code diff with SDK-annotated warnings
4. Explore three independent model review cards (click to expand)
5. See the consensus intelligence summary: "3 models agree on 3 critical risks"
6. View the final report with animated confidence gauge
7. Click "Generate Fixed Version" to see the auto-patched output with confidence improvement

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- (Optional) GitHub Copilot subscription or BYOK API keys

### Installation

```bash
git clone https://github.com/sooko-ai/sooko-devos.git
cd sooko-devos
npm install
```

### Configuration

Create a `.env.local` file (optional — the app runs in mock mode by default):

```env
# Set to "live" to use real Copilot SDK agent
COPILOT_SDK_MODE=mock

# BYOK keys for multi-model review (optional)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app runs fully in **mock mode** by default — no API keys required for the demo. Set `COPILOT_SDK_MODE=live` with BYOK keys to activate real model review.

---

## Project Structure

```
sooko-devos/
├── app/
│   ├── layout.tsx              # Root layout with fonts
│   ├── page.tsx                # Main orchestration page
│   ├── globals.css             # Global styles
│   └── api/
│       └── analyze/
│           └── route.ts        # Analysis API endpoint
├── components/
│   ├── Navbar.tsx              # Navigation bar
│   ├── Hero.tsx                # Landing hero + task input
│   ├── Timeline.tsx            # 7-stage progress indicator
│   ├── PlanView.tsx            # Execution plan display
│   ├── CodeDiffPanel.tsx       # Generated code diff view
│   ├── ReviewCards.tsx         # Model review cards (expandable)
│   ├── ConsensusPanel.tsx      # Consensus analysis + intelligence summary
│   ├── FinalReport.tsx         # Final report + confidence gauge
│   ├── FixPanel.tsx            # Generate Fixed Version modal
│   ├── LoadingState.tsx        # Loading + stage completion
│   └── ui/
│       ├── Badge.tsx           # Badge/chip component
│       └── Card.tsx            # Card container component
├── lib/
│   ├── agent.ts                # Copilot SDK agent integration
│   ├── plan.ts                 # Plan generation engine
│   ├── codegen.ts              # Code generation engine
│   ├── reviewers.ts            # Multi-model review engine
│   ├── consensus.ts            # Consensus scoring engine
│   ├── fixes.ts                # Fix generation engine
│   └── utils.ts                # Utility functions
├── types/
│   └── index.ts                # TypeScript type definitions
├── presentations/
│   └── SookoDevOS.pptx         # 2-slide pitch deck
├── feedback/
│   └── sooko-devos-feedback.md # Hackathon feedback PR file
├── AGENTS.md                   # Agent specification
├── apm.yml                     # APM manifest
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
├── .env.example
└── .gitignore
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Agent Runtime | GitHub Copilot SDK (`@github/copilot-sdk`) |
| Models | GPT-4o · Claude Sonnet 4 · Gemini 2.5 Pro |
| Icons | Lucide React |

---

## Copilot SDK Integration

The Copilot SDK powers the agentic workflow in `lib/agent.ts`:

- **Agent initialization** — creates a Copilot SDK client with BYOK provider configuration
- **Agent instructions** — defines the Sooko DevOS agent persona and structured output format
- **Tool definitions** — registers `generate_plan`, `generate_code`, `review_code`, and `build_consensus` as agent tools
- **Workflow orchestration** — runs the full 7-stage pipeline through the SDK runtime
- **BYOK support** — routes reviews to different model providers via Bring Your Own Key

See [AGENTS.md](./AGENTS.md) for the full agent specification.

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
- [x] 2-slide deck (see `/presentations/`)
- [x] 150-word submission summary
- [x] Feedback PR file (see `/feedback/`)
- [ ] 3-minute demo video

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
