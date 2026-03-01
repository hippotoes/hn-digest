"use server"
import { signIn, signOut } from "@/auth"

export async function loginAction() {
  await signIn("credentials", { email: "test@example.com", redirectTo: "/" })
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" })
}
