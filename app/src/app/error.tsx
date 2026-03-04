'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#0f0e0c] text-[#e8e2d6] font-serif p-8 flex flex-col items-center justify-center text-center">
      <div className="max-w-md p-12 border border-[#332f28] rounded-lg bg-[#0a0908]">
        <h2 className="font-heading text-2xl font-bold mb-4 text-[#d4a017]">Intelligence Briefing Unavailable</h2>
        <p className="text-[#9c9285] mb-8 leading-relaxed">
          The dispatch systems are currently offline or undergoing maintenance.
          Please check back momentarily.
        </p>
        <button
          onClick={() => reset()}
          className="hover:text-white border border-[#332f28] px-6 py-2 rounded font-mono text-xs uppercase tracking-widest"
        >
          Retry Connection
        </button>
      </div>
    </main>
  );
}
