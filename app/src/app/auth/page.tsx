"use client"
import { signupAction, loginAction } from "../actions";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function AuthForm() {
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
  const urlError = searchParams.get('error');

  async function handleSignup(formData: FormData) {
    setError(null);
    const result = await signupAction(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-8">
      {(error || urlError) && (
        <div className="mb-6 p-3 bg-red-900/30 border border-red-900 text-red-400 text-xs font-mono rounded" id="auth-error">
          {error || urlError}
        </div>
      )}

      {message && (
        <div className="mb-6 p-3 bg-green-900/30 border border-green-900 text-green-400 text-xs font-mono rounded" id="auth-message">
          {message}
        </div>
      )}

      {/* Login Form */}
      <section>
        <h2 className="font-mono text-xs text-[#9c9285] uppercase tracking-widest mb-4 border-b border-[#332f28] pb-2">Sign In</h2>
        <form action={loginAction} className="space-y-4">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="w-full bg-[#0f0e0c] border border-[#332f28] text-[#e8e2d6] p-2 rounded focus:outline-none focus:border-[#d4a017] font-mono text-sm"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            className="w-full bg-[#0f0e0c] border border-[#332f28] text-[#e8e2d6] p-2 rounded focus:outline-none focus:border-[#d4a017] font-mono text-sm"
          />
          <button
            type="submit"
            id="login-submit-btn"
            className="w-full bg-[#d4a017] text-[#0f0e0c] font-mono uppercase text-xs font-bold py-3 rounded hover:bg-[#b38a14] transition-colors"
          >
            Enter Briefing
          </button>
        </form>
      </section>

      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[#332f28]"></span>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#181613] px-2 text-[#5c564d] font-mono">Or create account</span>
        </div>
      </div>

      {/* Signup Form */}
      <section>
        <form action={handleSignup} className="space-y-4">
          <input
            name="email"
            type="email"
            placeholder="New Email"
            required
            className="w-full bg-[#0f0e0c] border border-[#332f28] text-[#e8e2d6] p-2 rounded focus:outline-none focus:border-[#d4a017] font-mono text-sm"
          />
          <input
            name="password"
            type="password"
            placeholder="New Password (8+ chars)"
            required
            className="w-full bg-[#0f0e0c] border border-[#332f28] text-[#e8e2d6] p-2 rounded focus:outline-none focus:border-[#d4a017] font-mono text-sm"
          />
          <button
            type="submit"
            id="signup-submit-btn"
            className="w-full border border-[#d4a017] text-[#d4a017] font-mono uppercase text-xs font-bold py-3 rounded hover:bg-[#d4a017]/10 transition-colors"
          >
            Register
          </button>
        </form>
      </section>
    </div>
  )
}

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-[#0f0e0c] flex items-center justify-center p-4 font-serif">
      <div className="max-w-md w-full bg-[#181613] border border-[#332f28] p-8 rounded-md">
        <h1 className="font-heading text-3xl font-bold text-[#e8e2d6] mb-8 text-center uppercase tracking-widest">
          Secure <span className="text-[#d4a017]">Identity</span>
        </h1>

        <Suspense fallback={<div className="text-[#9c9285] font-mono text-xs animate-pulse">Loading Identity Module...</div>}>
          <AuthForm />
        </Suspense>

        <p className="mt-8 text-center">
          <a href="/" className="text-[#5c564d] hover:text-[#9c9285] font-mono text-[10px] uppercase tracking-widest">
            ← Back to Intelligence
          </a>
        </p>
      </div>
    </div>
  );
}
