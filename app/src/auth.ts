import NextAuth from "next-auth"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/db"
import Credentials from "next-auth/providers/credentials"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      // This is a dummy credentials provider for local testing purposes only
      name: "Local Testing",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "test@example.com" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null

        // For local verification, we just find or create a user by email
        const userEmail = credentials.email as string

        // Use raw query or drizzle to find/upsert
        // Simplified for MVP: return a user object
        return {
          id: "test-user-id",
          name: "Test User",
          email: userEmail,
        }
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id
      }
      return session
    },
  },
})
