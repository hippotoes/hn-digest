# Mission 2 Implementation Prompts: "The Intelligent Expansion"
**Objective:** High-fidelity implementation guides for Stage 4 through Stage 7 with integrated HITL Quality Gates.

---

## Stage 4: Secure Identity (The "Iron Gate" Prompt)
> **Prompt:** "Act as a Senior Security Engineer. Upgrade the authentication system from mock credentials to a production-grade Email/Password implementation.
> 1. **Design:** Update the `users` table schema in `packages/db/schema.ts` to include a `passwordHash` field. Standardize on the `Argon2id` algorithm for all hashing operations.
> 2. **Implement:**
>    - Install `argon2` and `jose` in the `app` workspace.
>    - Create a `signupAction` in `app/src/app/actions.ts` that validates email/password complexity using Zod and persists the Argon2 hash to the DB.
>    - Update the NextAuth configuration in `app/src/auth.ts` to use a real `authorize` function that verifies hashes using `argon2.verify()`.
>    - Implement a clean Signup/Login UI using Shadcn components (Form, Input, Button).
> 3. **Test:** Write Vitest unit tests in `app/tests/auth.test.ts` for the hashing utility and password validation logic.
> 4. **Verify (Automated):** Use Playwright to automate a 'Signup -> Logout -> Login' flow on `localhost:3005`, asserting that the user's session is correctly established.
> 5. **Verify (HITL):**
>    - **Manual Signup:** Perform a signup with a real email. Verify the session persists after a hard browser refresh.
>    - **Security Check:** Query the DB manually (`select email, password_hash from user;`) to confirm hashes are stored and plaintext passwords are never saved.
>    - **UX Audit:** Evaluate if the password complexity error messages are clear and helpful."

---

## Stage 5: Stateful Bookmarks (The "Reactive State" Prompt)
> **Prompt:** "Act as a Full-Stack Architect. Implement stateful, soft-delete bookmarks using the 'Optimistic UI' pattern.
> 1. **Design:** Update the `bookmarks` schema to include an `isActive` boolean and an `updatedAt` timestamp. Prepare a Postgres CTE for atomic toggling.
> 2. **Implement:**
>    - Refactor the `bookmarkAction` in `app/src/app/actions.ts` to use an `UPSERT` logic: if a bookmark exists for that user/story, flip its `isActive` bit; otherwise, insert it.
>    - Update the Frontend `StoryCard` component to use the `useOptimistic` hook, ensuring the bookmark icon toggles instantly upon click.
>    - Enhance the 'Bookmarks' view to filter the digest server-side, showing only stories where `isActive` is true.
> 3. **Test:** Write integration tests ensuring that 5 rapid clicks on the bookmark button result in the correct final state in the DB without race conditions.
> 4. **Verify (Automated):** Use Playwright to click the bookmark icon and assert the CSS class changes immediately.
> 5. **Verify (HITL):**
>    - **Latency Test:** Click the bookmark on a slow network connection (simulated) to verify that the icon changes instantly (Optimistic UI) before the server responds.
>    - **State Check:** Un-bookmark a story, refresh the page, and confirm it remains un-bookmarked but exists in the DB with `is_active = false`."

---

## Stage 6: Temporal Navigation (The "Time Machine" Prompt)
> **Prompt:** "Act as a Performance Engineer. Implement a manifest-driven Calendar navigation system for historical digests.
> 1. **Design:** Define a Postgres `MATERIALIZED VIEW` named `digest_manifest` that aggregates unique dates from the `analyses` table.
> 2. **Implement:**
>    - Implement a Hono endpoint `GET /api/v1/digests/manifest` that serves the unique dates from the materialized view.
>    - Build a `CalendarNav` component using `react-day-picker` and Shadcn Popover.
>    - Use the manifest data to disable (grey out) dates in the calendar that have no digests.
>    - Implement dynamic routing `/digests/[date]` in Next.js to load the technical briefing for that specific historical day.
> 3. **Test:** Assert that the manifest API returns a sorted array of unique ISO date strings.
> 4. **Verify (Automated):** Playwright test to navigate to a historical URL and verify the `h1` contains the correct date string.
> 5. **Verify (HITL):**
>    - **Visual Audit:** Open the Calendar. Confirm that dates with data are visually distinct from disabled dates.
>    - **Navigation Feel:** Ensure that switching between dates feels "instant" due to Next.js data fetching and caching."

---

## Stage 7: Exhaustive Sentiment Engine (The "Deep Thread" Prompt)
> **Prompt:** "Act as a Staff AI Engineer. Build a multi-stage Map-Reduce pipeline to analyze 100% of Hacker News comment threads.
> 1. **Design:** Design a recursive scraping strategy in `worker/src/scraper.ts` that follows the `children` tree of an HN story to the very bottom. Plan a chunking strategy (batches of 50 comments) to stay within LLM context windows.
> 2. **Implement:**
>    - **Map Stage:** Update the BullMQ worker to process comment batches. Use Gemini 2.0 Flash to extract "Technical Arguments" and "Community Counterpoints" from each 50-comment batch.
>    - **Orchestration:** Use **BullMQ Flows** (parent/child jobs) to ensure the final "Reduce" (Synthesis) job only triggers once every "Map" (Extraction) job for a story is 100% complete.
>    - **Reduce Stage:** Use DeepSeek Reasoner to synthesize all intermediate argument summaries into 4 distinct, 100-word sentiment clusters with specific phrasing citations.
> 3. **Test:** Write a worker test that mocks an HN story with 300+ comments and verifies that all batches are correctly chunked and reduced.
> 4. **Verify (Automated):** Check the DB count for `sentiments` to ensure exactly 4 rows are created for the test story.
> 5. **Verify (HITL):**
>    - **Technical Depth Check:** Select a highly controversial story (e.g., a new programming language or a security flaw). Read the 4 sentiment clusters. Do they capture the "niche" technical disagreements found in the deep replies?
>    - **Citation Audit:** Confirm that the clusters use "HN terminology" (e.g., quoting specific user arguments) to prove they aren't just generic summaries."
