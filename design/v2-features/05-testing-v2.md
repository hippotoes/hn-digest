# Mission 2: Testing & Verification Prompts
**Objective:** Specialized verification for Auth, Bookmarks, Calendar, and Deep Sentiments.

## 1. Auth & Security Verification
> **Prompt:** "Act as a Security Auditor.
> 1. Verify that all passwords in the `users` table are hashed using Argon2id.
> 2. Ensure the signup action validates email formats and password complexity.
> 3. Verify that session tokens are not accessible via client-side JavaScript (HttpOnly)."

## 2. Bookmark Status Verification
> **Prompt:** "Act as a QA Engineer.
> 1. Verify that clicking 'Un-bookmark' does NOT delete the database row but sets `is_active` to false.
> 2. Confirm that the 'Saved' view only shows stories where `is_active` is true."

## 3. Calendar Data Integrity
> **Prompt:** "Act as a Data Engineer.
> 1. Assert that the `available-dates` manifest API does not include dates with 0 analyses.
> 2. Verify that selecting a date in the past correctly loads that specific day's digest via the Hono API."

## 4. Map-Reduce Sentiment Audit
> **Prompt:** "Act as an AI Specialist.
> 1. Inspect the intermediate 'Map' summaries for a story with 200+ comments. Do they lose significant data?
> 2. Audit the final 4-cluster synthesis. Does it feel comprehensive and technically deep?
> 3. Verify that the total word count for each cluster is approximately 100 words."
