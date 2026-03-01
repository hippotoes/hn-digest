import { db } from '@/db';
import { stories, analyses, sentiments, bookmarks } from '@hn-digest/db';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { auth } from "@/auth";
import { logoutAction } from "./actions";
import Link from 'next/link';
import BookmarkButton from '@/components/BookmarkButton';
import CalendarNav from '@/components/CalendarNav';

export default async function DailyDigestPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>
}) {
  const session = await auth();
  const { view, date: selectedDate } = await searchParams;
  const isSavedView = view === 'saved';

  const targetDate = selectedDate || new Date().toISOString().split('T')[0];

  // SOTA Query: Get LATEST analysis per story ID
  const latestAnalysesSubquery = db
    .selectDistinctOn([analyses.storyId], {
      id: analyses.id,
      storyId: analyses.storyId,
      topic: analyses.topic,
      summary: analyses.summary,
      rawJson: analyses.rawJson,
      createdAt: analyses.createdAt,
    })
    .from(analyses)
    .orderBy(analyses.storyId, desc(analyses.createdAt))
    .as('la');

  let digestItems: any[] = [];

  if (isSavedView && session?.user?.id) {
    const results = await db
      .select({
        story: stories,
        analysisId: latestAnalysesSubquery.id,
        analysisTopic: latestAnalysesSubquery.topic,
        analysisSummary: latestAnalysesSubquery.summary,
        analysisRawJson: latestAnalysesSubquery.rawJson,
      })
      .from(bookmarks)
      .innerJoin(stories, eq(bookmarks.storyId, stories.id))
      .innerJoin(latestAnalysesSubquery, eq(stories.id, latestAnalysesSubquery.storyId))
      .where(and(eq(bookmarks.userId, session.user.id), eq(bookmarks.isActive, true)))
      .orderBy(desc(stories.points));

    digestItems = results.map(r => ({
      story: r.story,
      analysis: { id: r.analysisId, topic: r.analysisTopic, summary: r.analysisSummary, rawJson: r.analysisRawJson }
    }));
  } else {
    const results = await db
      .select({
        story: stories,
        analysisId: latestAnalysesSubquery.id,
        analysisTopic: latestAnalysesSubquery.topic,
        analysisSummary: latestAnalysesSubquery.summary,
        analysisRawJson: latestAnalysesSubquery.rawJson,
      })
      .from(stories)
      .innerJoin(latestAnalysesSubquery, eq(stories.id, latestAnalysesSubquery.storyId))
      .where(sql`date_trunc('day', ${latestAnalysesSubquery.createdAt})::date = ${targetDate}`)
      .orderBy(desc(stories.points));

    digestItems = results.map(r => ({
      story: r.story,
      analysis: { id: r.analysisId, topic: r.analysisTopic, summary: r.analysisSummary, rawJson: r.analysisRawJson }
    }));
  }

  const analysisIds = digestItems.map(i => i.analysis.id);
  const allSentiments = analysisIds.length > 0
    ? await db.select().from(sentiments).where(inArray(sentiments.analysisId, analysisIds))
    : [];

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
          <h1 className="font-heading text-4xl font-bold mb-2 text-white">Hacker News <span className="text-[#d4a017]">Digest</span></h1>
          <nav className="flex gap-4 items-center">
            <p className="text-[#9c9285] font-mono text-sm uppercase tracking-widest">
              {isSavedView ? 'Library' : `Briefing: ${targetDate}`}
            </p>
            <span className="text-[#332f28]">|</span>
            <Link href="/" className={`text-[10px] font-mono uppercase ${!isSavedView ? 'text-[#d4a017]' : 'text-[#5c564d] hover:text-[#9c9285]'}`}>Latest</Link>
            <Link href="/?view=saved" className={`text-[10px] font-mono uppercase ${isSavedView ? 'text-[#d4a017]' : 'text-[#5c564d] hover:text-[#9c9285]'}`}>Bookmarks</Link>
            <span className="text-[#332f28]">|</span>
            <CalendarNav />
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

      <div className="max-w-4xl mx-auto space-y-32">
        {digestItems.map(({ story, analysis }) => {
          const parsedJson = JSON.parse(analysis.rawJson || '{}');
          const paragraphs = parsedJson.summary_paragraphs || [analysis.summary];

          const storyAllSentiments = allSentiments.filter(s => s.analysisId === analysis.id);

          // Strict logic to ensure NO merging:
          // 1. Find the article tone (prefer 'article' source, fallback to first item)
          let articleSentiment = storyAllSentiments.find(s => s.source === 'article');
          let communitySentiments = storyAllSentiments.filter(s => s.source === 'community');

          if (!articleSentiment && storyAllSentiments.length > 0) {
            articleSentiment = storyAllSentiments[0];
            communitySentiments = storyAllSentiments.slice(1);
          }

          return (
            <article key={story.id} className="story-card group" data-story-id={story.id}>
              <div className="flex justify-between items-start mb-2">
                <h2 className="font-heading text-3xl font-semibold flex-1 leading-tight text-white group-hover:text-[#d4a017] transition-colors">
                  <a href={story.url || '#'} target="_blank" rel="noopener noreferrer">
                    {story.title}
                  </a>
                </h2>
                {session && (
                  <BookmarkButton storyId={story.id} initialIsActive={activeBookmarkIds.has(story.id)} />
                )}
              </div>

              <div className="flex gap-4 font-mono text-[10px] text-[#9c9285] mb-8 uppercase tracking-[0.2em] border-b border-[#1a1814] pb-4">
                <span className="text-[#d4a017] font-bold">{analysis.topic}</span>
                <span>⬆ {story.points} pts</span>
                <span>By {story.author}</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-12">
                <div className="lg:col-span-2 text-[#d0c9bc] leading-relaxed text-lg space-y-6">
                  {paragraphs.map((p: string, idx: number) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>

                <div className="lg:col-span-1">
                  {articleSentiment && (
                    <div className="bg-[#181613] p-6 rounded border border-[#d4a017]/20 relative overflow-hidden h-full">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[#d4a017]"></div>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-mono uppercase text-[#d4a017] tracking-widest font-bold">Article Tone</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[#d4a017]/30 text-[#d4a017]">
                          {articleSentiment.sentimentType}
                        </span>
                      </div>
                      <h3 className="font-heading text-xl mb-3 text-white">{articleSentiment.label}</h3>
                      <p className="text-[13px] text-[#9c9285] leading-relaxed italic">"{articleSentiment.description}"</p>
                    </div>
                  )}
                </div>
              </div>

              {/* RENDER THE GRID FOR EVERY COMMUNITY SENTIMENT INDIVIDUALLY */}
              {communitySentiments.length > 0 && (
                <div className="mt-12 bg-[#0a0908] p-8 rounded-lg border border-[#1a1814]">
                  <h4 className="font-mono text-[10px] uppercase text-[#5c564d] tracking-[0.3em] mb-8 flex items-center gap-4">
                    <span>Community Reaction</span>
                    <div className="h-px flex-1 bg-[#1a1814]"></div>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {communitySentiments.map((s) => (
                      <div key={s.id} className="sentiment-block bg-[#14120f] p-5 rounded border border-[#25221d] hover:border-[#332f28] transition-all group/sent">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] font-mono uppercase text-[#9c9285] group-hover/sent:text-[#d4a017] tracking-tighter">{s.label}</span>
                          <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
                            s.sentimentType === 'positive' ? 'border-green-900/50 text-green-500' :
                            s.sentimentType === 'negative' ? 'border-red-900/50 text-red-500' :
                            'border-[#332f28] text-[#9c9285]'
                          }`}>
                            {s.sentimentType}
                          </span>
                        </div>
                        <p className="text-xs text-[#9c9285] leading-relaxed italic">"{s.description}"</p>
                        <div className="mt-4 pt-3 border-t border-[#1a1814] text-[9px] font-mono text-[#5c564d] flex justify-between">
                          <span>{s.agreement}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      <footer className="max-w-4xl mx-auto mt-32 pt-8 border-t border-[#332f28] text-center text-[#5c564d] font-mono text-[10px] uppercase tracking-widest pb-20">
        <p>Intelligence Briefing &bull; DeepSeek Reasoner &bull; Next.js 15 &bull; Drizzle</p>
      </footer>
    </main>
  );
}
