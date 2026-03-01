# Verification & Check Prompts
**Objective:** Non-functional checks for security, performance, and accessibility.

## 1. Security Verification
> **Prompt:** "Act as a Security Engineer. Audit the `hn-digest` codebase for the following:
> 1. Check all API endpoints for proper input validation using `Zod`.
> 2. Ensure sensitive keys (HN_API, GEMINI_API_KEY, DB_URL) are NOT logged or committed.
> 3. Verify CSRF protection in Server Actions and proper CORS headers in API routes.
> 4. Check for potential ReDoS (Regular Expression Denial of Service) in the scraper's regex logic."

## 2. Performance & Vitals Audit
> **Prompt:** "Act as a Web Performance Specialist. Verify the Next.js frontend vitals:
> 1. Run a Lighthouse audit on the `DailyDigestPage`. Ensure scores for Performance and Accessibility are > 90.
> 2. Check for 'Hydration Mismatch' errors in the search component.
> 3. Verify that the API uses proper `Cache-Control` and `stale-while-revalidate` headers.
> 4. Ensure images (if any) are optimized and text content uses `font-display: swap`."

## 3. Accessibility (a11y) Check
> **Prompt:** "Act as an Accessibility Expert. Audit the UI components:
> 1. Ensure all semantic HTML is correct (e.g., `<article>` for stories, `<h1>`–`<h3>` for hierarchy).
> 2. Verify color contrast ratios for the dark-first theme (`--bg: #0f0e0c`) against WCAG AA standards.
> 3. Check for proper ARIA labels on interactive elements (Category filters, Search box).
> 4. Ensure the page is fully navigable using only a keyboard."

## 4. LLM Hallucination & Accuracy Check
> **Prompt:** "Act as a Quality Assurance Engineer. Perform an accuracy audit:
> 1. Run the `Golden Dataset` (50 stories) through the `InferenceOrchestrator`.
> 2. Compare the AI-generated summaries against the original article text.
> 3. Flag any summaries that contain facts not present in the source material.
> 4. Use a judge model (e.g., Claude 3.5 Sonnet) to score the summaries for 'Factual Consistency'."
