# Stage 5: Stateful Interaction Implementation
**Objective:** Add persistent status to user bookmarks (Active/Inactive).

## 1. Schema Changes
The `bookmarks` table will be updated to include an `isActive` boolean.
```typescript
export const bookmarks = pgTable("bookmark", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text("userId").notNull().references(() => users.id),
  storyId: text("storyId").notNull().references(() => stories.id),
  isActive: boolean("is_active").default(true), // On/Off status
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
```

## 2. Technical Strategy
*   **Logic:** Instead of deleting a row when a user un-bookmarks, we toggle `isActive` to `false`.
*   **Frontend UI:**
    *   Solid icon 🔖 for `Active`.
    *   Outline icon 🏷️ for `Inactive` or a simple "Status: OFF" label.
    *   This allows the user to keep a history of "Read" but currently "Un-bookmarked" stories.

## 3. Implementation Workflow
1.  **Drizzle Migration:** Add `is_active` column.
2.  **API Update:** Modify `POST /api/v1/bookmarks` to toggle status instead of strictly inserting.
3.  **UI Update:** Add a "Bookmark Manager" view to show both on and off bookmarks.

## 4. Verification
-   **Auto-Test:** Assert that toggling a bookmark multiple times changes the `is_active` boolean in the DB rather than creating new rows.
-   **HITL:** Visual check that the UI correctly updates the "On/Off" icon state instantly via React `useOptimistic` or standard Server Action revalidation.
