import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisOrchestrator, QueueOrchestrator } from '../src/application/AnalysisOrchestrator';
import { StoryProvider, IntelligenceProvider, AnalysisRepository } from '../src/domain/ports';

describe('☢️ Nuclear AnalysisOrchestrator Pipeline (60 Cases)', () => {
  let orchestrator: AnalysisOrchestrator;
  let mockStoryProvider: StoryProvider;
  let mockIntelligenceProvider: IntelligenceProvider;
  let mockAnalysisRepository: AnalysisRepository;
  let mockQueue: QueueOrchestrator;

  beforeEach(() => {
    mockStoryProvider = { fetchTopStories: vi.fn() };
    mockIntelligenceProvider = { extractArguments: vi.fn(), generateAnalysis: vi.fn(), generateEmbedding: vi.fn() };
    mockAnalysisRepository = { getExistingStoryIds: vi.fn().mockResolvedValue([]), saveAnalysis: vi.fn() };
    mockQueue = { addFlow: vi.fn(), addStandardJob: vi.fn() };

    orchestrator = new AnalysisOrchestrator(
      mockStoryProvider,
      mockIntelligenceProvider,
      mockAnalysisRepository,
      mockQueue
    );
  });

  // 1. Chunking Matrix (20 cases)
  const chunkCases = Array.from({ length: 20 }, (_, i) => {
    const count = i * 25; // 0, 25, 50, 75, ... 475
    const expected = Math.max(1, Math.ceil(count / 50));
    return { count, expected };
  });

  it.each(chunkCases)('Case 1.$count: Creates $expected chunks for $count comments', async ({ count, expected }) => {
    const mockStories = [{ id: '1', title: 'T', comments: new Array(count).fill({ id: 'c' }) }];
    vi.mocked(mockStoryProvider.fetchTopStories).mockResolvedValue(mockStories as any);
    await orchestrator.runPipeline(1);

    if (count === 0) {
      const call = vi.mocked(mockQueue.addFlow).mock.calls[0][0];
      expect(call.children.length).toBe(0);
    } else {
      const call = vi.mocked(mockQueue.addFlow).mock.calls[0][0];
      expect(call.children.length).toBe(expected);
    }
  });

  // 2. Story Discovery Matrix (20 cases)
  const discoveryCases = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    totalStories: i + 1,
    existingCount: i % 2 === 0 ? Math.floor(i / 2) : 0,
    expectedFlows: i % 2 === 0 ? (i + 1) - Math.floor(i / 2) : (i + 1)
  }));

  it.each(discoveryCases)('Case 2.$id: Processes $expectedFlows new stories out of $totalStories', async ({ totalStories, existingCount, expectedFlows }) => {
    const allIds = Array.from({ length: totalStories }, (_, j) => `id-${j}`);
    const existingIds = allIds.slice(0, existingCount);
    const newStories = allIds.slice(existingCount).map(id => ({ id, title: 'T', url: 'U', comments: [] }));

    vi.mocked(mockAnalysisRepository.getExistingStoryIds).mockResolvedValue(existingIds);
    // Orchestrator calls fetchTopStories with (limit, skipIds)
    vi.mocked(mockStoryProvider.fetchTopStories).mockResolvedValue(newStories as any);

    await orchestrator.runPipeline(totalStories);

    expect(mockQueue.addFlow).toHaveBeenCalledTimes(expectedFlows);
  });

  // 3. Queue Flow Resilience (10 cases)
  const flowScenarios = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    failFlowAt: i % 3, // 0: immediate, 1: middle, 2: never
  }));

  it.each(flowScenarios)('Case 3.$id: Flow Resilience (Fail at $failFlowAt)', async ({ failFlowAt }) => {
    const mockStories = [{ id: '1', title: 'T', comments: [] }, { id: '2', title: 'T2', comments: [] }];
    vi.mocked(mockStoryProvider.fetchTopStories).mockResolvedValue(mockStories as any);

    if (failFlowAt === 0) {
      vi.mocked(mockQueue.addFlow).mockRejectedValueOnce(new Error('Queue Error'));
      await expect(orchestrator.runPipeline(10)).rejects.toThrow('Queue Error');
    } else if (failFlowAt === 1) {
      vi.mocked(mockQueue.addFlow)
        .mockResolvedValueOnce({} as any)
        .mockRejectedValueOnce(new Error('Queue Error'));
      await expect(orchestrator.runPipeline(10)).rejects.toThrow('Queue Error');
    } else {
      await orchestrator.runPipeline(10);
      expect(mockQueue.addFlow).toHaveBeenCalledTimes(2);
    }
  });

  // 4. Manifest Refresh Chain (10 cases)
  const manifestScenarios = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    hasStories: i % 2 === 0,
    failQueue: i % 3 === 0
  }));

  it.each(manifestScenarios)('Case 4.$id: Manifest Chain (Stories: $hasStories, Fail: $failQueue)', async ({ hasStories, failQueue }) => {
    const stories = hasStories ? [{ id: '1', title: 'T', comments: [] }] : [];
    vi.mocked(mockStoryProvider.fetchTopStories).mockResolvedValue(stories as any);

    if (failQueue && hasStories) {
      vi.mocked(mockQueue.addFlow).mockRejectedValue(new Error('Fail'));
      await expect(orchestrator.runPipeline(10)).rejects.toThrow('Fail');
      expect(mockQueue.addStandardJob).not.toHaveBeenCalledWith('refresh-manifest', expect.anything(), expect.anything());
    } else {
      await orchestrator.runPipeline(10);
      if (hasStories) {
        expect(mockQueue.addStandardJob).toHaveBeenCalledWith('refresh-manifest', expect.anything(), expect.anything());
      } else {
        expect(mockQueue.addStandardJob).not.toHaveBeenCalledWith('refresh-manifest', expect.anything(), expect.anything());
      }
    }
  });
});
