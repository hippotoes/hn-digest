# Mission 2 UI/UX Specification
**Theme:** "The Modern Broadside" (V2)

## 1. Design Tokens (The SOTA Foundation)
```yaml
Colors:
  Brand: "#d4a017" (Amber)
  Background: "#0f0e0c" (Rich Black)
  Surface: "#181613" (Card Grey)
  Border: "#332f28" (Muted Bronze)
  Positive: "#22c55e"
  Negative: "#ef4444"
  Neutral: "#9c9285"

Typography:
  Heading: "Playfair Display" (Serif, Bold)
  Body: "Source Serif 4" (Serif, Regular)
  Monospace: "DM Mono" (Mono, Data stats)
```

## 2. Component Specifications

### 2.1. The Briefing Calendar (Stage 6)
*   **Trigger:** Fixed sidebar icon or floating action button.
*   **SOTA Implementation:** Use a custom `react-day-picker` instance.
*   **State:**
    *   `Active`: Dark Amber circle around dates with digests.
    *   `Disabled`: Opacity 0.3 for empty dates.
*   **Interaction:** Smooth transition to target date digest via Next.js `loading.tsx` skeleton screens.

### 2.2. Sentiment Cluster Cards (Stage 7)
*   **Layout:** 2x2 Grid for Desktop, Vertical Stack for Mobile.
*   **Interaction:** "Click to Expand" functionality using Framer Motion layout animations.
*   **Content:** Cluster summary (bold first sentence), prevalence score, and representative "HN Pull Quote."

### 2.3. Stateful Bookmark Toggle (Stage 5)
*   **SOTA Logic:** `useOptimistic` hook.
*   **Feedback:** Instant icon swap (Outline -> Solid) before server confirmation.
*   **Status Overlay:** Small "Saved" or "Removed" toast notifications (Sonner/Shadcn Toast).

## 3. Atomic Design Mapping
*   **Atoms:** Bookmark Icon, Category Badge, Date String.
*   **Molecules:** Story Header, Sentiment Block, Calendar Day.
*   **Organisms:** Daily Digest Card, Navigation Sidebar.
*   **Templates:** Daily Briefing View, Saved Stories Gallery.
