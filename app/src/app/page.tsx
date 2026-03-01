import { db } from '@/db';
import { stories, analyses } from '@hn-digest/db';
import { eq, desc } from 'drizzle-orm';
import { auth } from "@/auth";
import { loginAction, logoutAction } from "./actions";

export default async function DailyDigestPage() {
  const session = await auth();

  // Fetch stories joined with their analysis
  const digestItems = await db
    .select({
      story: stories,
      analysis: analyses,
    })
    .from(stories)
    .innerJoin(analyses, eq(stories.id, analyses.storyId))
    .orderBy(desc(stories.points));

  return (
    <main className="min-h-screen bg-[#0f0e0c] text-[#e8e2d6] font-serif p-8">
      <header className="max-w-4xl mx-auto mb-12 border-b border-[#332f28] pb-6 flex justify-between items-end">
        <div>
          <h1 className="font-heading text-4xl font-bold mb-2">Hacker News <span className="text-[#d4a017]">Digest</span></h1>
          <p className="text-[#9c9285] font-mono text-sm uppercase tracking-widest">Intelligence Briefing</p>
        </div>

        <div className="flex gap-4 font-mono text-xs uppercase tracking-tighter">
          {session ? (
            <div className="flex items-center gap-4">
              <span className="text-[#d4a017]" id="user-email">● {session.user?.email}</span>
              <form action={logoutAction}>
                <button type="submit" className="hover:text-white border border-[#332f28] px-2 py-1 rounded" id="logout-btn">Logout</button>
              </form>
            </div>
          ) : (
            <form action={loginAction}>
              <button type="submit" className="hover:text-white border border-[#332f28] px-2 py-1 rounded" id="login-btn">Login</button>
            </form>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-12">
        {digestItems.map(({ story, analysis }) => (
          <article key={story.id} className="p-6 bg-[#181613] border border-[#332f28] rounded-md story-card relative group">
            <div className="flex justify-between items-start mb-2">
              <h2 className="font-heading text-2xl font-semibold flex-1">
                <a href={story.url || '#'} target="_blank" rel="noopener noreferrer" className="hover:opacity-75 transition-opacity">
                  {story.title}
                </a>
              </h2>
              {session && (
                <button className="text-[#9c9285] hover:text-[#d4a017] transition-colors p-1" title="Bookmark">
                  🔖
                </button>
              )}
            </div>

            <div className="flex gap-4 font-mono text-xs text-[#9c9285] mb-4">
              <span className="bg-[#25221d] px-2 py-0.5 rounded text-[#d4a017] uppercase tracking-widest text-[10px] font-bold">
                {analysis.topic}
              </span>
              <span>⬆ {story.points} pts</span>
              <span>By {story.author}</span>
            </div>

            <div className="text-[#d0c9bc] leading-relaxed">
              {/* Render the first two paragraphs from the real DeepSeek analysis if available */}
              {typeof analysis.summary === 'string' ? (
                <p className="whitespace-pre-line">{analysis.summary}</p>
              ) : (
                <p>Analysis parsing error.</p>
              )}
            </div>
          </article>
        ))}

        {digestItems.length === 0 && (
          <p className="text-[#9c9285] italic text-center py-20">No stories found for today. Run the scraper worker.</p>
        )}
      </div>

      <footer className="max-w-4xl mx-auto mt-20 pt-8 border-t border-[#332f28] text-center text-[#5c564d] font-mono text-[10px] uppercase tracking-widest">
        <p>Built by Gemini CLI Agent &bull; DeepSeek Reasoner &bull; Next.js 15 &bull; Drizzle</p>
      </footer>
    </main>
  );
}
