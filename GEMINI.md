# Gemini CLI Project Rules: HN Digest Overhaul

This document defines the foundational mandates and technical standards for the `hn-digest` overhaul. As an agent, you MUST adhere to these rules at all times.

## 1. Core Principles & Philosophy
- **MVP First:** Focus on an end-to-end containerized pipeline (Fetch -> Analyze -> Store -> View) before adding advanced features.
- **100% Local Parity:** Every feature must be verifiable in the local Docker environment (`docker-compose`).
- **Deployment from Day 1:** CI/CD and infrastructure configuration are first-class citizens.
- **Clean Architecture:** Adhere to SOLID, DRY, KISS, and YAGNI principles. Use the "Clean Hexagon" pattern (Domain, Infrastructure, Application).

## 2. Technical Stack Mandates
- **Frontend:** Next.js 15 (App Router) using React Server Components (RSC) by default.
- **API Framework:** Hono (integrated with Next.js Route Handlers).
- **Queueing:** BullMQ + Redis for all asynchronous background tasks.
- **Database:** PostgreSQL 16+ with `pgvector` via Drizzle ORM.
- **AI/LLM:** Gemini 2.0 Flash (Primary), DeepSeek-V3 (Fallback).
- **Validation:** Strict `Zod` schemas for all data ingress/egress.
- **Scraper:** Node-based with a Python bridge to `Trafilatura` for text extraction.

## 3. Workflow & Routine
Follow the 5-step loop for every task:
1. **Context Alignment:** Read module docs in `design/`.
2. **Isolated Implementation:** Develop within Docker containers.
3. **Local Verification:** Run `docker-compose run --rm worker npm test` and manual checks.
4. **Documentation & Schema Sync:** Update `db/schema.ts` and `design/*.md` as needed.
5. **Commit:** Ensure `pre-commit` hooks pass.

## 4. Engineering Standards
- **TypeScript:** Strict mode, no `any`, interfaces over types.
- **Testing:** Unit (Vitest), Integration (Dockerized), and E2E (Playwright).
- **AI Reliability:** Implement "Self-Healing JSON" with `json-repair` and LLM-as-a-Judge validation.
- **Observability:** Structured logging (Pino) and OpenTelemetry tracing.
- **UI/UX:** "Modern Broadside" theme (Source Serif 4, Playfair Display), Dark Mode default (`--bg: #0f0e0c`).

## 5. Security & Safety
- **Credential Protection:** Never log or commit API keys/secrets. Use `.env.example` for local dev.
- **Validation:** Sanitize all scraped HTML before passing to LLMs.
- **Audits:** Regular security, performance (Lighthouse > 90), and accessibility (WCAG AA) checks are mandatory.

---
*Refer to the `design/` directory for detailed module specifications.*
