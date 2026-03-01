"use server"
import { signIn, signOut, auth } from "@/auth"
import { db } from "@/db"
import { bookmarks } from "@hn-digest/db"
import { revalidatePath } from "next/cache"

export async function loginAction() {
  await signIn("credentials", { email: "test@example.com", redirectTo: "/" })
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" })
}

export async function bookmarkAction(storyId: string) {
  const session = await auth()
  if (!session?.user?.id) return

  try {
    await db.insert(bookmarks).values({
      userId: session.user.id,
      storyId: storyId
    })
    revalidatePath("/")
  } catch (err) {
    console.error("Bookmark failed:", err)
  }
}
