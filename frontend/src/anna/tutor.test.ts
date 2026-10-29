import { describe, expect, it, vi } from 'vitest';
import type { CourseChunk, TutorMessage } from './models';
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
      get: vi.fn(), set: vi.fn(), delete: vi.fn(), list: vi.fn(),
    },
  } as unknown as AnnaRuntime;
  return { runtime, complete };
}

function earlierMessage(role: TutorMessage['role'], content: string, id: string): TutorMessage {
  return { id, role, content, created_at: '2026-10-29T10:00:00Z' };
}

function citedHistory(): TutorMessage[] {
  return [
    earlierMessage('user', 'How do I calculate vector magnitude?', 'student1'),
    {
      ...earlierMessage('assistant', 'What is the norm of this vector?', 'tutor1'),
      metadata: { sources: [{
        source: 'vectors.md', type: 'course_material', chunk_ids: ['vectors#1'],
      }] },
    },
  ];
}

describe('Anna tutoring adapter', () => {
  it('adds retrieved sources and Socratic instructions to the model request', async () => {
    const { runtime, complete } = fakeRuntime();
    const tutor = new AnnaTutorService(runtime, chunks);
    const result = await tutor.answerQuestion('What is a vector magnitude?', [], 'low', null);

    expect(result.sources).toEqual([{
      source: 'vectors.md', type: 'course_material', chunk_ids: ['vectors#1'],
    }]);
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

  it('does not cite a course passage matched only by a generic instruction verb', async () => {
    const { runtime, complete } = fakeRuntime();
    const tutor = new AnnaTutorService(runtime, [{
      ...chunks[0], content: 'Calculate a vector magnitude before solving the next problem.',
    }]);

    const result = await tutor.answerQuestion('How do I calculate income tax?', [], 'medium', null);
    expect(result.sources).toEqual([]);
    expect(complete.mock.calls[0][0].messages[0].content)
      .toContain('No relevant course-material excerpt');
  });

  it.each([
    'Why does that step work?',
    'Could you give me one more small hint about the previous question without revealing the full solution?',
    'Can you explain why the previous mathematical step is valid?',
    'Can you give me a similar exercise to try on my own, without showing its solution?',
    'Podes explicar esse passo novamente?',
    'Why?',
  ])('carries the preceding answer\'s exact evidence for a contextual question: %s', async (followUp) => {
    const { runtime, complete } = fakeRuntime();
    const history = citedHistory();
    const result = await new AnnaTutorService(runtime, chunks)
      .answerQuestion(followUp, history, 'medium', null);

    expect(result.sources).toEqual([{
      source: 'vectors.md', type: 'course_material', chunk_ids: ['vectors#1'],
    }]);
    const messages = complete.mock.calls[0][0].messages;
    expect(messages.map(({ role }: { role: string }) => role))
      .toEqual(['user', 'assistant', 'user']);
    expect(messages[2].content).toContain('Passages from the immediately preceding tutor answer');
    expect(messages[2].content).toContain('[Source 1: vectors.md]');
    expect(messages[2].content).toContain(`Student question:\n${followUp}`);
    expect(history[1].metadata?.sources?.[0].chunk_ids).toEqual(['vectors#1']);
    expect(complete).toHaveBeenCalledOnce();
  });

  it.each([
    'Can you give me another hint about income tax?',
    'Why does the previous step work in photosynthesis?',
    'What is the latest football ranking?',
  ])('does not carry mathematical evidence to a new subject: %s', async (question) => {
    const { runtime, complete } = fakeRuntime();
    const result = await new AnnaTutorService(runtime, chunks)
      .answerQuestion(question, citedHistory(), 'medium', null);
    expect(result.sources).toEqual([]);
    expect(complete.mock.calls[0][0].messages[2].content)
      .toContain('No relevant course-material excerpt');
  });

  it('prefers direct retrieval when the student changes to a different math topic', async () => {
    const { runtime, complete } = fakeRuntime();
    const matrixChunk: CourseChunk = {
      id: 'matrices#1', source: 'matrices.md', type: 'course_material',
      topic: 'matrices', chapter: null, content: 'A matrix represents a linear transformation.',
    };
    const result = await new AnnaTutorService(runtime, [...chunks, matrixChunk])
      .answerQuestion('What is a matrix?', citedHistory(), 'medium', null);

    expect(result.sources).toEqual([{
      source: 'matrices.md', type: 'course_material', chunk_ids: ['matrices#1'],
    }]);
    expect(complete.mock.calls[0][0].messages[2].content)
      .toContain('Relevant course excerpts (reference only)');
    expect(complete.mock.calls[0][0].messages[2].content).not.toContain('[Source 1: vectors.md]');
  });

  it('does not reuse sources from a different topic, missing IDs, or mismatched file metadata', async () => {
    const { runtime, complete } = fakeRuntime();
    const tutor = new AnnaTutorService(runtime, chunks);
    const history = citedHistory();
    const prompt = 'Can you explain why the previous mathematical step is valid?';

    expect((await tutor.answerQuestion(prompt, history, 'medium', 'matrices')).sources).toEqual([]);
    history[1].metadata = { sources: [{
      source: 'vectors.md', type: 'course_material', chunk_ids: ['vectors#outdated'],
    }] };
    expect((await tutor.answerQuestion(prompt, history, 'medium', null)).sources).toEqual([]);
    history[1].metadata = { sources: [{
      source: 'another-file.md', type: 'course_material', chunk_ids: ['vectors#1'],
    }] };
    expect((await tutor.answerQuestion(prompt, history, 'medium', null)).sources).toEqual([]);
    expect(complete).toHaveBeenCalledTimes(3);
    for (const call of complete.mock.calls) {
      expect(call[0].messages[2].content).toContain('No relevant course-material excerpt');
    }
  });

  it('does not invent prior evidence from an older answer or an incomplete turn', async () => {
    const { runtime } = fakeRuntime();
    const tutor = new AnnaTutorService(runtime, chunks);
    const previous = citedHistory();
    const uncited = [
      ...previous,
      earlierMessage('user', 'Another problem', 'student2'),
      earlierMessage('assistant', 'How would you start?', 'tutor2'),
    ];
    const prompt = 'Why does that step work?';

    expect((await tutor.answerQuestion(prompt, uncited, 'medium', null)).sources).toEqual([]);
    expect((await tutor.answerQuestion(prompt, [
      ...previous, earlierMessage('user', 'Unanswered question', 'pending'),
    ], 'medium', null)).sources).toEqual([]);
  });

  it('retains every retrieved passage ID while grouping references by source file', async () => {
    const { runtime } = fakeRuntime();
    const tutor = new AnnaTutorService(runtime, [
      chunks[0],
      { ...chunks[0], id: 'vectors#2', content: 'Vector magnitude is also called the norm.' },
    ]);

    const result = await tutor.answerQuestion('vector magnitude norm', [], 'medium', null);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].source).toBe('vectors.md');
    expect(result.sources[0].chunk_ids).toEqual(expect.arrayContaining(['vectors#1', 'vectors#2']));
  });

  it('validates question length and refuses truncated model outputs', async () => {
    const { runtime, complete } = fakeRuntime();
    const tutor = new AnnaTutorService(runtime, chunks);
    await expect(tutor.answerQuestion('  ', [], 'medium', null)).rejects.toThrow('1–4000');

    complete.mockResolvedValueOnce({ role: 'assistant', content: { type: 'text', text: 'Partial' }, stopReason: 'maxTokens' });
    await expect(tutor.answerQuestion('vector', [], 'medium', null)).rejects.toThrow('truncated');
  });

  it('sends at most five complete, recent exchanges in chronological order', async () => {
    const { runtime, complete } = fakeRuntime();
    const history = Array.from({ length: 6 }, (_, index) => [
      earlierMessage('user', `Previous student question ${index}`, `q${index}`),
      earlierMessage('assistant', `Previous tutor answer ${index}`, `a${index}`),
    ]).flat();

    await new AnnaTutorService(runtime, chunks)
      .answerQuestion('What is a vector?', history, 'medium', null);

    const messages = complete.mock.calls[0][0].messages;
    expect(messages).toHaveLength(11);
    expect(messages.slice(0, -1).map(({ role }: { role: string }) => role))
      .toEqual(Array.from({ length: 5 }, () => ['user', 'assistant']).flat());
    expect(messages[0].content).toBe('Previous student question 1');
    expect(messages[9].content).toBe('Previous tutor answer 5');
    expect(messages[10].content).toContain('Student question:\nWhat is a vector?');
  });

  it('bounds oversized earlier turns without changing the active question or saved history', async () => {
    const { runtime, complete } = fakeRuntime();
    const history = [
      earlierMessage('user', 'An older question', 'old-question'),
      earlierMessage('assistant', 'An older reply', 'old-reply'),
      earlierMessage('user', 'Q'.repeat(3500), 'recent-question'),
      earlierMessage('assistant', 'A'.repeat(8000), 'recent-reply'),
    ];
    const savedContents = history.map((entry) => entry.content);
    const currentQuestion = 'vector '.repeat(570).trim();

    await new AnnaTutorService(runtime, chunks)
      .answerQuestion(currentQuestion, history, 'high', null);

    const messages = complete.mock.calls[0][0].messages;
    expect(messages).toHaveLength(3);
    expect(messages.slice(0, 2).map(({ role }: { role: string }) => role))
      .toEqual(['user', 'assistant']);
    expect(messages[0].content.length + messages[1].content.length).toBeLessThanOrEqual(6000);
    expect(messages[0].content).toContain('[Middle of earlier message omitted');
    expect(messages[1].content).toContain('[Middle of earlier message omitted');
    expect(messages[0].content).toMatch(/^Q+\n/);
    expect(messages[1].content).toMatch(/A+$/);
    expect(messages[2].content).toContain(currentQuestion);
    expect(messages[2].content).toContain('[Source 1: vectors.md]');
    expect(history.map((entry) => entry.content)).toEqual(savedContents);
  });

  it('omits an older complete pair instead of sending an incomplete pair', async () => {
    const { runtime, complete } = fakeRuntime();
    const history = Array.from({ length: 4 }, (_, index) => [
      earlierMessage('user', `Q${index} ${'x'.repeat(1200)}`, `q${index}`),
      earlierMessage('assistant', `A${index} ${'y'.repeat(1200)}`, `a${index}`),
    ]).flat();

    await new AnnaTutorService(runtime, chunks)
      .answerQuestion('vector', history, 'medium', null);

    const messages = complete.mock.calls[0][0].messages;
    expect(messages).toHaveLength(5); // Two complete exchanges plus this question.
    expect(messages[0].content).toContain('Q2');
    expect(messages[1].content).toContain('A2');
    expect(messages[2].content).toContain('Q3');
    expect(messages[3].content).toContain('A3');
  });
});
