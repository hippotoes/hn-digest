import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisOrchestrator, QueueOrchestrator } from '../src/application/AnalysisOrchestrator';
import { StoryProvider, IntelligenceProvider, AnalysisRepository } from '../src/domain/ports';

describe('AnalysisOrchestrator', () => {
  let orchestrator: AnalysisOrchestrator;
  let mockStoryProvider: StoryProvider;
  let mockIntelligenceProvider: IntelligenceProvider;
  let mockAnalysisRepository: AnalysisRepository;
  let mockQueue: QueueOrchestrator;

  beforeEach(() => {
    mockStoryProvider = {
      fetchTopStories: vi.fn(),
    };
    mockIntelligenceProvider = {
      extractArguments: vi.fn(),
      generateAnalysis: vi.fn(),
      generateEmbedding: vi.fn(),
    };
    mockAnalysisRepository = {
      getExistingStoryIds: vi.fn().mockResolvedValue([]),
      saveAnalysis: vi.fn(),
    };
    mockQueue = {
      addFlow: vi.fn(),
      addStandardJob: vi.fn(),
    };

    orchestrator = new AnalysisOrchestrator(
      mockStoryProvider,
      mockIntelligenceProvider,
      mockAnalysisRepository,
      mockQueue
    );
  });

  it('should not enqueue anything if no new stories are found', async () => {
    vi.mocked(mockStoryProvider.fetchTopStories).mockResolvedValue([]);

    await orchestrator.runPipeline(10);

    expect(mockQueue.addFlow).not.toHaveBeenCalled();
    expect(mockQueue.addStandardJob).not.toHaveBeenCalled();
  });

  it('should enqueue a flow for each new story', async () => {
    const mockStories = [
      { id: '1', title: 'Story 1', url: 'http://1', comments: [], points: 10, author: 'a', timestamp: new Date(), rawContent: '' },
      { id: '2', title: 'Story 2', url: 'http://2', comments: new Array(60).fill({ id: 'c' }), points: 20, author: 'b', timestamp: new Date(), rawContent: '' }
    ];
    vi.mocked(mockStoryProvider.fetchTopStories).mockResolvedValue(mockStories as any);

    await orchestrator.runPipeline(10);

    expect(mockQueue.addFlow).toHaveBeenCalledTimes(2);
    // Check chunking logic (60 comments should result in 2 chunks)
    const secondCall = vi.mocked(mockQueue.addFlow).mock.calls[1][0];
    expect(secondCall.children.length).toBe(2);

    expect(mockQueue.addStandardJob).toHaveBeenCalledWith('refresh-manifest', expect.anything(), expect.anything());
  });

  it('should skip stories that already exist in the repository', async () => {
    vi.mocked(mockAnalysisRepository.getExistingStoryIds).mockResolvedValue(['1']);

    await orchestrator.runPipeline(10);

    expect(mockStoryProvider.fetchTopStories).toHaveBeenCalledWith(10, ['1']);
  });
});
