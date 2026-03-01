# Coding Standards & Best Practices
**Objective:** High-quality, maintainable, and idiomatic codebase.

## 1. Core Principles
-   **SOLID Principles:** Ensure classes/functions have a single responsibility and are open for extension but closed for modification.
-   **DRY (Don't Repeat Yourself):** Abstract common logic (e.g., API calls, date formatting) into reusable utilities.
-   **KISS (Keep It Simple, Stupid):** Avoid over-engineering; prefer readable, explicit code over clever but obscure patterns.
-   **YAGNI (You Ain't Gonna Need It):** Only implement features or abstractions when they are actually needed.

## 2. Architecture: "The Clean Hexagon"
-   **Domain Layer:** Business logic (story models, analysis rules) should be independent of frameworks (Next.js, Drizzle).
-   **Infrastucture Layer:** External services (HN API, LLM API, Database) should be implemented as adapters.
-   **Application Layer:** Use-case orchestrators (e.g., `GenerateDailyDigestUseCase`) that coordinate domain and infrastructure.

## 3. Language & Tooling
-   **TypeScript:** Use strict mode, avoid `any` at all costs, and prefer `interface` over `type`.
-   **Linting/Formatting:** Strict `eslint` (with `@typescript-eslint/recommended`) and `prettier`.
-   **Zod:** Use for all runtime data validation (API responses, environment variables, user input).

## 4. API Design (SOTA Standards)
-   **RESTful:** Use proper HTTP verbs (GET, POST, PATCH, DELETE) and status codes (200, 201, 400, 401, 404, 500).
-   **JSON-First:** All API responses should be structured, versioned, and follow a consistent camelCase naming convention.
-   **Rate Limiting & Security:** Implement global rate limiting, CORS, and CSRF protection.

## 5. Frontend Conventions
-   **Component-First:** Build reusable, accessible UI components (Atomic Design).
-   **Server-First:** Leverage Next.js Server Components (RSC) by default; only use client components when interactivity is required.
-   **Tailwind CSS:** Use consistent spacing, color scales, and responsive design patterns.

## 6. Pro Advices (Staff-Level)
-   **Observability:** Always include structured logging (e.g., `pino` or `winston`) and performance tracing (OpenTelemetry).
-   **Dependency Injection:** Pass dependencies (e.g., `llmProvider`, `storyRepo`) into services to facilitate testing and flexibility.
-   **Feature Flags:** Use feature flags (e.g., `LaunchDarkly` or a custom DB-backed system) for risky rollouts (e.g., switching LLM models).
-   **Documentation:** Maintain an up-to-date `README.md` and keep the `design/` folder in sync with the actual implementation.
