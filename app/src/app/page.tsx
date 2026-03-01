import { db } from '@/db';
import { stories, analyses } from '@hn-digest/db';
import { eq } from 'drizzle-orm';

export default async function DailyDigestPage() {
  // Fetch stories joined with their analysis
  const digestItems = await db
    .select()
    .from(stories)
    .innerJoin(analyses, eq(stories.id, analyses.storyId))
    .orderBy(stories.points);

  return (
    <main className="min-h-screen bg-[#0f0e0c] text-[#e8e2d6] font-serif p-8">
      <header className="max-w-4xl mx-auto mb-12 border-b border-[#332f28] pb-6">
        <h1 className="font-heading text-4xl font-bold mb-2">Hacker News <span className="text-[#d4a017]">Digest</span></h1>
        <p className="text-[#9c9285] font-mono text-sm uppercase tracking-widest">Intelligence Briefing</p>
      </header>

      <div className="max-w-4xl mx-auto space-y-12">
        {digestItems.map(({ stories: story, analyses: analysis }) => (
          <article key={story.id} className="p-6 bg-[#181613] border border-[#332f28] rounded-md story-card">
            <h2 className="font-heading text-2xl font-semibold mb-2">
              <a href={story.url || '#'} target="_blank" rel="noopener noreferrer" className="hover:opacity-75 transition-opacity">
                {story.title}
              </a>
            </h2>
            <div className="flex gap-4 font-mono text-xs text-[#9c9285] mb-4">
              <span>⬆ {story.points} pts</span>
              <span>By {story.author}</span>
            </div>
            <div className="text-[#d0c9bc] leading-relaxed">
              <p>{analysis.summary}</p>
            </div>
          </article>
        ))}
        {digestItems.length === 0 && (
          <p className="text-[#9c9285] italic">No stories found for today. Run the scraper worker.</p>
        )}
      </div>
    </main>
  );
}
