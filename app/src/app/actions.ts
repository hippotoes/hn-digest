"use server"
import { signIn, signOut, auth } from "@/auth"
import { db } from "@/db"
import { bookmarks, users } from "@hn-digest/db"
import { revalidatePath } from "next/cache"
import { hash } from "argon2"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { redirect } from 'next/navigation'

const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  try {
    await signIn("credentials", { email, password, redirectTo: "/" })
  } catch (error) {
    if ((error as any).message === "NEXT_REDIRECT") {
      throw error
    }
    if ((error as any).type === "CredentialsSignin") {
      redirect("/auth?error=Invalid credentials")
    }
    // Re-throw redirect errors specifically
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      throw error;
    }
    throw error
  }
}

export async function signupAction(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const result = AuthSchema.safeParse({ email, password })
  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  try {
    const passwordHash = await hash(password)
    await db.insert(users).values({
      email,
      passwordHash,
      name: email.split('@')[0],
    })

    console.log(`[Signup] User created: ${email}`);
  } catch (err: any) {
    console.error(`[Signup] Error:`, err);
    return { error: "Signup failed (User may exist)" }
  }

  redirect("/auth?message=Signup successful. Please sign in.")
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" })
}

export async function bookmarkAction(storyId: string) {
  const session = await auth()
  if (!session?.user?.id) return

  try {
    const existing = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, session.user.id), eq(bookmarks.storyId, storyId)))
      .limit(1);

    if (existing.length > 0) {
      await db.update(bookmarks)
        .set({ isActive: !existing[0].isActive, updatedAt: new Date() })
        .where(eq(bookmarks.id, existing[0].id));
    } else {
      await db.insert(bookmarks).values({
        userId: session.user.id,
        storyId: storyId,
        isActive: true
      });
    }
    revalidatePath("/")
  } catch (err) {
    console.error("Bookmark toggle failed:", err)
  }
}
