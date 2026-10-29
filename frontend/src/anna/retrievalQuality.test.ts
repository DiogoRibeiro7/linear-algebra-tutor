/** Offline retrieval regression suite over the actual distributable course index. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { isCourseChunk, type CourseChunk } from './models';
import { retrieveChunks } from './retrieval';

interface RetrievalCase {
  readonly language: 'en' | 'pt';
  readonly question: string;
  readonly expectedSource: string;
}

/** Parallel questions test a concept, not exact copied sentences from the text. */
const cases: readonly RetrievalCase[] = [
  { language: 'en', question: 'How do I add two vectors?', expectedSource: 'chapter1_vectors.md' },
  { language: 'en', question: 'How does matrix multiplication work?', expectedSource: 'chapter2_matrices.md' },
  { language: 'en', question: 'Explain Gaussian elimination for linear systems.', expectedSource: 'chapter3_linear_systems.md' },
  { language: 'en', question: 'What are linear independence and a basis?', expectedSource: 'chapter4_subspaces_and_bases.md' },
  { language: 'en', question: 'How do I find the kernel of a linear transformation?', expectedSource: 'chapter5_linear_transformations.md' },
  { language: 'en', question: 'What does a determinant mean geometrically?', expectedSource: 'chapter6_determinants.md' },
  { language: 'en', question: 'How are eigenvalues and eigenvectors calculated?', expectedSource: 'chapter7_eigenvalues.md' },
  { language: 'en', question: 'How do orthogonal projections and least squares work?', expectedSource: 'chapter8_orthogonality_least_squares.md' },
  { language: 'pt', question: 'Como somar dois vetores?', expectedSource: 'chapter1_vectors.md' },
  { language: 'pt', question: 'Como multiplicar matrizes?', expectedSource: 'chapter2_matrices.md' },
  { language: 'pt', question: 'Como resolver sistemas lineares por eliminação de Gauss?', expectedSource: 'chapter3_linear_systems.md' },
  { language: 'pt', question: 'O que é uma base e a independência linear?', expectedSource: 'chapter4_subspaces_and_bases.md' },
  { language: 'pt', question: 'Como encontrar o núcleo de uma transformação linear?', expectedSource: 'chapter5_linear_transformations.md' },
  { language: 'pt', question: 'Qual é o significado geométrico do determinante?', expectedSource: 'chapter6_determinants.md' },
  { language: 'pt', question: 'Como calcular autovalores e autovetores?', expectedSource: 'chapter7_eigenvalues.md' },
  { language: 'pt', question: 'Como usar projeções ortogonais e mínimos quadrados?', expectedSource: 'chapter8_orthogonality_least_squares.md' },
];

/** Curated false-attribution checks; these requests share generic course vocabulary. */
const unrelatedQuestions: readonly { language: 'en' | 'pt'; question: string }[] = [
  { language: 'en', question: 'How do I calculate my income taxes?' },
  { language: 'en', question: 'Help me solve a customer service problem.' },
  { language: 'en', question: 'How do I rank football teams by their goals?' },
  { language: 'en', question: 'Explain our company business transformation.' },
  { language: 'en', question: 'How can I install an operating system?' },
  { language: 'pt', question: 'Como calcular o imposto sobre o rendimento?' },
  { language: 'pt', question: 'Como resolver um problema com a minha encomenda?' },
  { language: 'pt', question: 'Como ordenar equipas pelo posto no campeonato?' },
  { language: 'pt', question: 'Explica a transformação digital de uma empresa.' },
  { language: 'pt', question: 'Como instalar um sistema operativo no portátil?' },
];

let chunks: CourseChunk[];

beforeAll(async () => {
  // Package test scripts rebuild this index from data/materials before Vitest.
  const location = resolve(process.cwd(), 'anna/public/course-materials.json');
  const parsed: unknown = JSON.parse(await readFile(location, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isCourseChunk)) {
    throw new TypeError('Build the validated course index before running retrieval tests');
  }
  chunks = parsed;
});

describe('Anna course retrieval quality', () => {
  it.each(cases)('retrieves $expectedSource for a $language question', ({ question, expectedSource }) => {
    const matches = retrieveChunks(question, chunks, { topK: 3 });
    expect(matches.map(({ chunk }) => chunk.source)).toContain(expectedSource);
  });

  it('reports recall@1 and mean reciprocal rank over the fixed bilingual questions', () => {
    const ranks = cases.map(({ question, expectedSource }) => {
      const rank = retrieveChunks(question, chunks, { topK: 3 })
        .findIndex(({ chunk }) => chunk.source === expectedSource);
      return rank < 0 ? 0 : rank + 1;
    });
    const recallAt1 = ranks.filter((rank) => rank === 1).length / ranks.length;
    const meanReciprocalRank = ranks.reduce((sum, rank) => sum + (rank ? 1 / rank : 0), 0)
      / ranks.length;
    // The explicit chapter checks above are the recall@3 guardrail.
    expect(recallAt1).toBeGreaterThanOrEqual(0.7);
    expect(meanReciprocalRank).toBeGreaterThanOrEqual(0.8);
    console.info(`Anna retrieval: recall@1=${recallAt1.toFixed(3)}, MRR@3=${meanReciprocalRank.toFixed(3)}`);
  });

  it('is deterministic and never invents sources for unrelated questions', () => {
    const question = 'Explain the spectral theorem';
    const first = retrieveChunks(question, chunks, { topK: 3 });
    expect(retrieveChunks(question, chunks, { topK: 3 })).toEqual(first);
    expect(retrieveChunks('photosynthesis in chloroplasts', chunks)).toEqual([]);
  });

  it.each(unrelatedQuestions)('does not attach course sources to unrelated $language queries', ({ question }) => {
    expect(retrieveChunks(question, chunks, { topK: 3 })).toEqual([]);
  });

  it('keeps course evidence for short concept questions and a topic filter', () => {
    expect(retrieveChunks('What is a matrix?', chunks)[0].chunk.source)
      .toBe('chapter2_matrices.md');
    expect(retrieveChunks('Explain the spectral theorem', chunks)
      .some(({ chunk }) => chunk.source === 'chapter7_eigenvalues.md')).toBe(true);
    expect(retrieveChunks('Como resolver um sistema de equações?', chunks).length)
      .toBeGreaterThan(0);
    expect(retrieveChunks('How do I solve a system?', chunks).length)
      .toBeGreaterThan(0);
    expect(retrieveChunks('How do I calculate my taxes?', chunks, { topic: 'vectors' }))
      .toEqual([]);
  });

  it('reports false source attribution over the curated bilingual negatives', () => {
    const falseAttributions = unrelatedQuestions.filter(({ question }) =>
      retrieveChunks(question, chunks, { topK: 3 }).length > 0).length;
    const rate = falseAttributions / unrelatedQuestions.length;
    expect(rate).toBe(0);
    console.info(`Anna retrieval: curated false attribution=${rate.toFixed(3)}`);
  });
});
