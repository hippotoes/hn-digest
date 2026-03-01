# Mission 2: Feature Expansion & Deep Intelligence
**Objective:** Enhance user engagement via secure authentication, personalized story state, and exhaustive community sentiment analysis.

## 1. Architectural Evolution
To support the new requirements, the system will undergo the following refinements:
*   **Identity Layer:** Upgrade from mock credentials to a secure `Argon2id` hashing strategy.
*   **State Management:** Transition bookmarks from a simple join table to a stateful interaction log.
*   **Date Orchestration:** Implement a daily "Manifest Service" to drive the Calendar UI.
*   **Deep Scrape Pipeline:** Implement a Map-Reduce style summarization for exhaustive HN comment threads to bypass LLM context limits.

## 2. Delivery Stages
1.  **Stage 4 (Secure Identity):** Email/Password Signup & Signin.
2.  **Stage 5 (Stateful Interaction):** Status-based Bookmarks.
3.  **Stage 6 (Temporal Navigation):** Calendar-driven Digest Browsing.
4.  **Stage 7 (Exhaustive Sentiment):** Full-thread Comment Processing.
