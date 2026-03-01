import NextAuth from "next-auth"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/db"
import Credentials from "next-auth/providers/credentials"
import { users } from "@hn-digest/db"
import { eq } from "drizzle-orm"
import { hash, verify } from "argon2"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt" },
  debug: true,
  providers: [
    Credentials({
      name: "Secure Identity",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log(`[Auth] Authorizing: ${credentials?.email}`);
        if (!credentials?.email || !credentials?.password) return null

        const userEmail = credentials.email as string
        const password = credentials.password as string

        const [user] = await db.select().from(users).where(eq(users.email, userEmail))
        if (!user || !user.passwordHash) {
          console.warn(`[Auth] User not found: ${userEmail}`)
          return null
        }

        const isValid = await verify(user.passwordHash, password)
        if (!isValid) {
          console.warn(`[Auth] Invalid password for: ${userEmail}`)
          return null
        }

        console.log(`[Auth] Success: ${userEmail}`);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      console.log(`[Auth] JWT Callback. User: ${user?.email}`);
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      return token
    },
    session({ session, token }) {
      console.log(`[Auth] Session Callback. Token: ${token?.email}`);
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
      }
      return session
    },
  },
})
