# Stage 6: Temporal Navigation Implementation
**Objective:** Navigate historical digests via a calendar UI restricted to "available" dates.

## 1. Technical Strategy
*   **Availability Manifest:** To avoid expensive full-table scans every time the calendar opens, we implement a **Postgres Materialized View** that calculates unique dates from the `analyses` table. This view is refreshed concurrently nightly.
*   **API Endpoint:** `GET /api/v1/digests/manifest`
    *   Returns: `string[]` (ISO date strings like `["2026-02-28", "2026-03-01"]`).
*   **Calendar Component:**
    *   Use a library like `react-day-picker` or `shadcn/ui/calendar`.
    *   Use the `disabled` prop to disable any date NOT present in the manifest.

## 2. Implementation Workflow
1.  **Backend:** Create an optimized SQL query using `DISTINCT date_trunc('day', created_at)`.
2.  **API:** Implement the manifest route in Hono.
3.  **Frontend:**
    *   Add a "Briefing Archive" button that opens a Calendar Popover.
    *   On date selection, navigate to `/digests/[date]`.

## 3. Verification
-   **Auto-Test:** Assert that the manifest API only returns dates that actually have entries in the `analyses` table.
-   **HITL:** Human attempt to select a day with no data (it should be unclickable) and a day with data (it should navigate correctly).
