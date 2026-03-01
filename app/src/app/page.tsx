import { db } from '@/db';
import { stories, analyses, sentiments, bookmarks } from '@hn-digest/db';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { auth } from "@/auth";
import { logoutAction } from "./actions";
import Link from 'next/link';
import BookmarkButton from '@/components/BookmarkButton';

export default async function DailyDigestPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const session = await auth();
  const { view } = await searchParams;
  const isSavedView = view === 'saved';

  // Base query: fetch stories joined with analysis
  let query = db
    .select({
      story: stories,
      analysis: analyses,
    })
    .from(stories)
    .innerJoin(analyses, eq(stories.id, analyses.storyId))
    .orderBy(desc(stories.points));

  // If in "Saved" view, filter by user bookmarks
  if (isSavedView && session?.user?.id) {
    query = db
      .select({
        story: stories,
        analysis: analyses,
      })
      .from(bookmarks)
      .innerJoin(stories, eq(bookmarks.storyId, stories.id))
      .innerJoin(analyses, eq(stories.id, analyses.storyId))
      .where(and(eq(bookmarks.userId, session.user.id), eq(bookmarks.isActive, true)))
      .orderBy(desc(stories.points)) as any;
  }

  const digestItems = await query;

  // Fetch all sentiments for the displayed stories
  const analysisIds = digestItems.map(i => i.analysis.id);
  const allSentiments = analysisIds.length > 0
    ? await db.select().from(sentiments).where(inArray(sentiments.analysisId, analysisIds))
    : [];

  // Fetch current user's active bookmarks to set initial state
  const activeBookmarkIds = new Set<string>();
  if (session?.user?.id) {
    const userBookmarks = await db
      .select({ storyId: bookmarks.storyId })
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, session.user.id), eq(bookmarks.isActive, true)));
    userBookmarks.forEach(b => activeBookmarkIds.add(b.storyId));
  }

  return (
    <main className="min-h-screen bg-[#0f0e0c] text-[#e8e2d6] font-serif p-8">
      <header className="max-w-4xl mx-auto mb-12 border-b border-[#332f28] pb-6 flex justify-between items-end">
        <div>
          <h1 className="font-heading text-4xl font-bold mb-2">Hacker News <span className="text-[#d4a017]">Digest</span></h1>
          <nav className="flex gap-4 items-center">
            <p className="text-[#9c9285] font-mono text-sm uppercase tracking-widest">Intelligence Briefing</p>
            <span className="text-[#332f28]">|</span>
            <Link href="/" className={`text-[10px] font-mono uppercase ${!isSavedView ? 'text-[#d4a017]' : 'text-[#5c564d] hover:text-[#9c9285]'}`}>Latest</Link>
            <Link href="/?view=saved" className={`text-[10px] font-mono uppercase ${isSavedView ? 'text-[#d4a017]' : 'text-[#5c564d] hover:text-[#9c9285]'}`}>Bookmarks</Link>
          </nav>
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
            <Link href="/auth" className="hover:text-white border border-[#332f28] px-3 py-1 rounded" id="login-link">
              Authenticate
            </Link>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-16">
        {digestItems.map(({ story, analysis }) => {
          const parsedJson = JSON.parse(analysis.rawJson || '{}');
          const paragraphs = parsedJson.summary_paragraphs || [analysis.summary];
          const storySentiments = allSentiments.filter(s => s.analysisId === analysis.id);

          return (
            <article key={story.id} className="story-card group">
              <div className="flex justify-between items-start mb-2">
                <h2 className="font-heading text-2xl font-semibold flex-1 leading-tight">
                  <a href={story.url || '#'} target="_blank" rel="noopener noreferrer" className="hover:text-[#d4a017] transition-colors">
                    {story.title}
                  </a>
                </h2>
                {session && (
                  <BookmarkButton
                    storyId={story.id}
                    initialIsActive={activeBookmarkIds.has(story.id)}
                  />
                )}
              </div>

              <div className="flex gap-4 font-mono text-[10px] text-[#9c9285] mb-6 uppercase tracking-widest">
                <span className="text-[#d4a017] font-bold underline underline-offset-4 decoration-[#d4a017]/30">
                  {analysis.topic}
                </span>
                <span>⬆ {story.points} pts</span>
                <span>By {story.author}</span>
              </div>

              <div className="text-[#d0c9bc] leading-relaxed text-lg space-y-6 mb-8">
                {paragraphs.map((p: string, idx: number) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>

              {/* Sentiment Clusters UI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-[#1a1814]">
                {storySentiments.map((s) => (
                  <div key={s.id} className="bg-[#14120f] p-4 rounded border border-[#25221d]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-mono uppercase text-[#9c9285] tracking-tighter">{s.label}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                        s.sentimentType === 'positive' ? 'border-green-900/50 text-green-500' :
                        s.sentimentType === 'negative' ? 'border-red-900/50 text-red-500' :
                        'border-[#332f28] text-[#9c9285]'
                      }`}>
                        {s.sentimentType}
                      </span>
                    </div>
                    <p className="text-xs text-[#9c9285] leading-snug">{s.description}</p>
                    <div className="mt-2 text-[9px] font-mono text-[#5c564d]">{s.agreement}</div>
                  </div>
                ))}
              </div>
            </article>
          )
        })}

        {digestItems.length === 0 && (
          <p className="text-[#9c9285] italic text-center py-20 font-mono uppercase tracking-widest">No entries found.</p>
        )}
      </div>

      <footer className="max-w-4xl mx-auto mt-20 pt-8 border-t border-[#332f28] text-center text-[#5c564d] font-mono text-[10px] uppercase tracking-widest">
        <p>Built by Gemini CLI Agent &bull; DeepSeek Reasoner &bull; Next.js 15 &bull; Drizzle</p>
      </footer>
    </main>
  );
}
