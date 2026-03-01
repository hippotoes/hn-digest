# Stage 4: Secure Identity Implementation
**Objective:** Replace mock auth with a production-grade Email/Password system.

## 1. Schema Changes
The `users` table needs a non-nullable password hash field.
```typescript
export const users = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  // ... existing fields
})
```

## 2. Technical Strategy
*   **Hashing:** Use `argon2` or `bcrypt` (Argon2id is the current SOTA recommendation).
*   **NextAuth Integration:**
    *   Transition `auth.ts` to use a real `authorize` function.
    *   Implement a `SignupAction` server action to handle user creation.
*   **Security Guardrails:**
    *   Enforce password complexity (8+ chars, mix of types).
    *   Rate limit login attempts via BullMQ/Redis to prevent brute-force attacks.

## 3. Implementation Workflow
1.  **DB Migration:** Add `password_hash` to `user` table.
2.  **Signup API:** Create `/api/auth/signup` or a Server Action.
3.  **Auth Logic:** Update `CredentialsProvider` to verify hashes using `argon2.verify()`.

## 4. Verification
-   **Auto-Test:** Vitest to verify that a user can signup, login with correct creds, and is rejected with incorrect creds.
-   **HITL:** Human attempt to sign up with a real email and verify the session persists across page refreshes.
