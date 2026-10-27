import { describe, expect, it, vi } from 'vitest';
import type { CourseChunk } from './models';
import type { AnnaRuntime } from './runtime';
import { AnnaTutorService } from './tutor';

const chunks: CourseChunk[] = [{
  id: 'vectors#1', source: 'vectors.md', type: 'course_material',
  topic: 'vectors', chapter: null, content: 'A vector has a magnitude and direction.',
}];

function fakeRuntime() {
  const complete = vi.fn().mockResolvedValue({
    role: 'assistant', content: { type: 'text', text: 'How would you calculate its norm?' },
    model: 'mock', stopReason: 'endTurn',
  });
  const runtime = {
    llm: { complete },
    storage: {
      get: vi.fn(), set: vi.fn(), delete: vi.fn(),
    },
  } as unknown as AnnaRuntime;
  return { runtime, complete };
}

describe('Anna tutoring adapter', () => {
  it('adds retrieved sources and Socratic instructions to the model request', async () => {
    const { runtime, complete } = fakeRuntime();
    const tutor = new AnnaTutorService(runtime, chunks);
    const result = await tutor.answerQuestion('What is a vector magnitude?', [], 'low', null);

    expect(result.sources).toEqual([{ source: 'vectors.md', type: 'course_material' }]);
    expect(complete).toHaveBeenCalledTimes(1);
    const request = complete.mock.calls[0][0];
    expect(request.systemPrompt).toContain('Minimal hints');
    expect(request.messages[0].content).toContain('[Source 1: vectors.md]');
    expect(request.messages[0].content).toContain('What is a vector magnitude?');
  });

  it('sends no invented context when retrieval has no matches', async () => {
    const { runtime, complete } = fakeRuntime();
    const result = await new AnnaTutorService(runtime, chunks)
      .answerQuestion('photosynthesis', [], 'medium', null);
    expect(result.sources).toEqual([]);
    expect(complete.mock.calls[0][0].messages[0].content).toContain('No relevant');
  });

  it('validates question length and refuses truncated model outputs', async () => {
    const { runtime, complete } = fakeRuntime();
    const tutor = new AnnaTutorService(runtime, chunks);
    await expect(tutor.answerQuestion('  ', [], 'medium', null)).rejects.toThrow('1–4000');

    complete.mockResolvedValueOnce({ role: 'assistant', content: { type: 'text', text: 'Partial' }, stopReason: 'maxTokens' });
    await expect(tutor.answerQuestion('vector', [], 'medium', null)).rejects.toThrow('truncated');
  });
});
