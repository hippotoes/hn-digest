import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Job } from 'bullmq';

vi.mock('ioredis', () => ({ default: class { on() {} } }));
vi.mock('bullmq', () => ({ Queue: class {}, Worker: class {}, FlowProducer: class {} }));

const { mockDbExecute, mockGenerateAnalysis, mockGenerateEmbedding, mockExtractArguments, mockSaveAnalysis } = vi.hoisted(() => ({
  mockDbExecute: vi.fn(),
  mockGenerateAnalysis: vi.fn(),
  mockGenerateEmbedding: vi.fn(),
  mockExtractArguments: vi.fn(),
  mockSaveAnalysis: vi.fn()
}));

vi.mock('../src/infrastructure/db', () => ({ db: { execute: mockDbExecute } }));
vi.mock('../src/infrastructure/MultiLLMIntelligenceProvider', () => ({
  MultiLLMIntelligenceProvider: class {
    generateAnalysis = mockGenerateAnalysis;
    generateEmbedding = mockGenerateEmbedding;
    extractArguments = mockExtractArguments;
  }
}));
vi.mock('../src/infrastructure/DrizzleAnalysisRepository', () => ({
  DrizzleAnalysisRepository: class { saveAnalysis = mockSaveAnalysis; }
}));

import { processJob } from '../src/infrastructure/BullMQQueue';

describe('☢️ Nuclear BullMQ Worker Stress (160 Cases)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGenerateAnalysis.mockResolvedValue({ summary_paragraphs: ['P'] });
    mockGenerateEmbedding.mockResolvedValue([0.1]);
    mockExtractArguments.mockResolvedValue('Signal');
  });

  const createMockJob = (name: string, data: any = {}, children: any = { 'c1': 's1' }): Job => ({
    id: `job-${Math.random()}`,
    name,
    data,
    opts: { jobId: `trace-${Math.random()}` },
    getChildrenValues: vi.fn().mockResolvedValue(children)
  } as unknown as Job);

  // 1. Job Type & Payload Matrix (40 cases)
  const jobTypes = ['refresh-manifest', 'synthesize-analysis', 'extract-arguments', 'unknown'];
  const payloadScenarios = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    type: jobTypes[i % jobTypes.length],
    dataSize: i * 100
  }));

  it.each(payloadScenarios)('Case 1.$id: Processes $type with $dataSize bytes', async ({ type, dataSize }) => {
    const data = type === 'synthesize-analysis' ? { story: { id: '1', title: 'T'.repeat(dataSize) } } : { storyId: '1', comments: [] };
    const job = createMockJob(type, data);
    const result = await processJob(job);
    if (type === 'unknown' || type === 'refresh-manifest') {
      expect(result).toBeUndefined();
    } else {
      expect(result).toBeDefined();
    }
  });

  // 2. Child Signals Stress (40 cases)
  const signalScenarios = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    childCount: i % 10,
    signalLen: i * 50
  }));

  it.each(signalScenarios)('Case 2.$id: Aggregates $childCount signals', async ({ childCount, signalLen }) => {
    const children: Record<string, string> = {};
    for (let j = 0; j < childCount; j++) children[`c${j}`] = 'S'.repeat(signalLen);

    const job = createMockJob('synthesize-analysis', { story: { id: '1' } }, children);
    await processJob(job);

    if (childCount > 0) {
      const expectedSignal = Object.values(children).join('\n\n');
      expect(mockGenerateAnalysis).toHaveBeenCalledWith(expect.anything(), expectedSignal);
    }
  });

  // 3. Failure Mode Matrix (40 cases)
  const failureScenarios = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    failDb: i % 3 === 0,
    failLLM: i % 4 === 0,
    failEmb: i % 5 === 0
  }));

  it.each(failureScenarios)('Case 3.$id: Resilience (DB:$failDb, LLM:$failLLM, Emb:$failEmb)', async ({ failDb, failLLM, failEmb }) => {
    if (failDb) mockDbExecute.mockRejectedValue(new Error('DB Fail'));
    if (failLLM) mockGenerateAnalysis.mockRejectedValue(new Error('LLM Fail'));
    if (failEmb) mockGenerateEmbedding.mockRejectedValue(new Error('Emb Fail'));

    const job = createMockJob('synthesize-analysis', { story: { id: '1' } });

    if (failLLM) {
      await expect(processJob(job)).rejects.toThrow('LLM Fail');
    } else {
      const result = await processJob(job);
      expect(result).toBeDefined();
      // Embedding failure shouldn't throw
      if (failEmb && !failDb) {
        expect(mockSaveAnalysis).toHaveBeenCalledWith(expect.anything(), expect.anything(), []);
      }
    }
  });

  // 4. Trace & ID Resilience (40 cases)
  const idScenarios = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    traceId: i % 2 === 0 ? `id-${i}` : undefined,
    jobId: i % 3 === 0 ? `job-${i}` : null
  }));

  it.each(idScenarios)('Case 4.$id: ID Resilience (Trace:$traceId, Job:$jobId)', async ({ traceId, jobId }) => {
    const job = {
      name: 'refresh-manifest',
      data: {},
      id: jobId,
      opts: { jobId: traceId },
      getChildrenValues: vi.fn().mockResolvedValue({})
    } as unknown as Job;

    await processJob(job);
    expect(mockDbExecute).toHaveBeenCalled();
  });
});
