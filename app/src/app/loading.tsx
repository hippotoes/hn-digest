export default function Loading() {
  return (
    <main className="min-h-screen bg-[#0f0e0c] text-[#e8e2d6] font-serif p-8">
      <div className="max-w-4xl mx-auto space-y-32">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-10 bg-[#1a1814] rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-[#1a1814] rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2 space-y-4">
                <div className="h-4 bg-[#1a1814] rounded w-full"></div>
                <div className="h-4 bg-[#1a1814] rounded w-5/6"></div>
                <div className="h-4 bg-[#1a1814] rounded w-4/5"></div>
              </div>
              <div className="lg:col-span-1">
                <div className="h-40 bg-[#1a1814] rounded w-full"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
