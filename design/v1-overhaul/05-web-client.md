# Module E: Web Client
**Objective:** A high-speed, aesthetically pleasing, and responsive interface for HN Digests.

## 1. Responsibilities
-   Render complex daily digests across all devices (Desktop, Tablet, Mobile).
-   Enable search with real-time feedback.
-   Provide interactive sentiment graphs/charts.
-   Enable user login and personalization.

## 2. Core Components & Logic
-   **Server Components (RSC):**
    -   `DailyDigestPage`: Fetches stories from the API/DB and renders the static structure.
    -   `StoryList`: Handles grouping by category and ranking.
-   **Client Components (Hydrated):**
    -   `SearchBox`: Uses `useTransition` for non-blocking search result updates.
    -   `SentimentGauge`: Interactive Recharts component showing agreement level.
    -   `ExpandableSummary`: Accordion-style summary text with animated transitions.
-   **Shared UI (Shadcn UI):**
    -   Buttons, Badges, Tabs, and Dialogs for a consistent, enterprise-grade feel.

## 3. UI/UX: "The Modern Broadside"
-   **Typography:** Playfair Display (Serif) for headings, Source Serif 4 for body.
-   **Color Palette:** Dark Mode by default (`--bg: #0f0e0c`).
-   **Interactivity:**
    -   Clicking a category filter smooth-scrolls to the section.
    -   Sentiment clusters show prevalence as a visual bar or badge.
    -   Story summaries expand to show key points or full analysis.

## 4. Performance & Caching
-   **Images:** No external images by default (text-heavy). Native SVGs for icons.
-   **Streaming:** Use `Suspense` to stream the `StoryList` while the `Navbar` and `Masthead` render instantly.
-   **Hydration Strategy:** Minimize client-side JS by keeping most logic in Server Actions.

## 5. Technology Stack
-   **Framework:** Next.js 15 (App Router).
-   **Styling:** Tailwind CSS + Shadcn UI.
-   **State Management:** React Server Actions + `zustand` (if needed for global client state).
-   **Charts:** `recharts` or `tremor`.
