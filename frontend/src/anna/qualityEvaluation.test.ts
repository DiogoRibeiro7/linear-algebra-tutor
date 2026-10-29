/** Offline checks for the fixed, educator-reviewable Anna mathematical QA set. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import referenceCases from '../../../integrations/anna/evaluation/cases.json';
import { isCourseChunk, type CourseChunk, type HintLevel } from './models';
import type { AnnaRuntime } from './runtime';
import { retrieveChunks } from './retrieval';
import { AnnaTutorService } from './tutor';

type Language = 'en' | 'pt';

interface EvaluationCase {
  readonly id: string;
  readonly language: Language;
  readonly topic: string;
  readonly hintLevel: HintLevel;
  readonly expectedSource: string;
  readonly question: string;
  readonly referenceCheck: string;
  readonly socraticGoal: string;
}

/** Verify all external JSON fields before using them as test cases. */
function isEvaluationCase(value: unknown): value is EvaluationCase {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && row.id.length > 0
    && (row.language === 'en' || row.language === 'pt')
    && typeof row.topic === 'string' && row.topic.length > 0
    && (row.hintLevel === 'low' || row.hintLevel === 'medium' || row.hintLevel === 'high')
    && typeof row.expectedSource === 'string' && row.expectedSource.length > 0
    && typeof row.question === 'string' && row.question.trim().length > 0
    && row.question.length <= 4000
    && typeof row.referenceCheck === 'string' && row.referenceCheck.trim().length > 0
    && typeof row.socraticGoal === 'string' && row.socraticGoal.trim().length > 0;
}

const untrustedCases: unknown = referenceCases;
if (!Array.isArray(untrustedCases) || !untrustedCases.every(isEvaluationCase)) {
  throw new TypeError('Anna evaluation cases must match the documented schema');
}
const cases: readonly EvaluationCase[] = untrustedCases;
let chunks: CourseChunk[];

beforeAll(async () => {
  // Yarn builds this distributable index before running the Vitest suite.
  const indexPath = resolve(process.cwd(), 'anna/public/course-materials.json');
  const parsed: unknown = JSON.parse(await readFile(indexPath, 'utf8'));
  if (!Array.isArray(parsed) || !parsed.length || !parsed.every(isCourseChunk)) {
    throw new TypeError('A validated Anna course index is required for the quality suite');
  }
  chunks = parsed;
});

describe('Anna release evaluation cases', () => {
  it('covers every chapter in English and Portuguese, including each hint level', () => {
    expect(cases).toHaveLength(16);
    expect(new Set(cases.map(({ id }) => id)).size).toBe(cases.length);
    expect(new Set(cases.map(({ hintLevel }) => hintLevel)))
      .toEqual(new Set<HintLevel>(['low', 'medium', 'high']));

    const chapters = new Set(chunks.map(({ topic }) => topic));
    expect(chapters.size).toBe(8);
    for (const language of ['en', 'pt'] as const) {
      const languageCases = cases.filter((entry) => entry.language === language);
      expect(languageCases).toHaveLength(chapters.size);
      expect(new Set(languageCases.map(({ topic }) => topic))).toEqual(chapters);
    }
  });

  it('retrieves the correct distributable chapter for every fixed question', () => {
    for (const entry of cases) {
      const expected = chunks.find(({ source }) => source === entry.expectedSource);
      expect(expected?.topic, entry.id).toBe(entry.topic);

      // Check both the natural no-filter path and the selected-topic path.
      for (const topic of [null, entry.topic]) {
        const matches = retrieveChunks(entry.question, chunks, { topK: 3, topic });
        expect(matches.map(({ chunk }) => chunk.source), `${entry.id} (${topic ?? 'all'})`)
          .toContain(entry.expectedSource);
      }
    }
  });

  it('constructs grounded Socratic requests without spending model tokens', async () => {
    for (const entry of cases) {
      // These fixtures inspect prompt construction only; they are not an
      // accuracy score for any real Anna model's mathematical response.
      const complete = vi.fn().mockResolvedValue({
        role: 'assistant', content: { type: 'text', text: 'What would you try next?' },
        model: 'offline-mock', stopReason: 'endTurn',
      });
      const runtime = {
        llm: { complete },
        storage: { get: vi.fn(), set: vi.fn(), delete: vi.fn(), list: vi.fn() },
      } as unknown as AnnaRuntime;
      const tutor = new AnnaTutorService(runtime, chunks);
      const result = await tutor.answerQuestion(entry.question, [], entry.hintLevel, entry.topic);
      expect(result.sources.map(({ source }) => source), entry.id)
        .toContain(entry.expectedSource);
      expect(complete).toHaveBeenCalledOnce();

      const request = complete.mock.calls[0][0];
      expect(request.systemPrompt).toContain('Use the Socratic method');
      expect(request.systemPrompt).toContain('Use the same language as the student');
      expect(request.systemPrompt).toContain('Do not invent citations');
      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].content).toContain(`Student question:\n${entry.question}`);
      expect(request.messages[0].content).toContain(entry.expectedSource);
    }
  });
});
