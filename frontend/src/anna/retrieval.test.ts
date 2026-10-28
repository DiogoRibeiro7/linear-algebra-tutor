import { describe, expect, it } from 'vitest';
import { retrieveChunks, tokenize } from './retrieval';
import type { CourseChunk } from './models';

const documents: CourseChunk[] = [
  {
    id: 'vectors.md#1', source: 'vectors.md', type: 'course_material',
    topic: 'vectors', chapter: '1', content: 'Vector addition and dot product operations',
  },
  {
    id: 'matrices.md#1', source: 'matrices.md', type: 'course_material',
    topic: 'matrices', chapter: '2', content: 'Matrix determinant and inverse matrix properties',
  },
  {
    id: 'vectors.md#2', source: 'vectors.md', type: 'course_material',
    topic: 'vectors', chapter: '1', content: 'The magnitude of a vector is its norm',
  },
];

describe('Anna BM25 retrieval', () => {
  it('normalizes accented Portuguese words', () => {
    expect(tokenize('Qual é a definição de combinação linear?')).toContain('combinacao');
  });

  it('canonicalizes Portuguese and English mathematical vocabulary', () => {
    expect(tokenize('Como calcular autovalores e autovetores?'))
      .toEqual(['calculate', 'eigenvalue', 'eigenvector']);
    expect(tokenize('How are eigenvalues and eigenvectors calculated?'))
      .toEqual(['eigenvalue', 'eigenvector', 'calculate']);
    expect(tokenize('valores próprios e vetores próprios'))
      .toEqual(['eigenvalue', 'eigenvector']);
  });

  it('ranks the matching course chapter first', () => {
    const matches = retrieveChunks('determinant of a matrix', documents);
    expect(matches[0].chunk.source).toBe('matrices.md');
    expect(matches[0].score).toBeGreaterThan(0);
  });

  it('respects the topic filter', () => {
    const matches = retrieveChunks('vector magnitude', documents, { topic: 'VECTORS' });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every(({ chunk }) => chunk.topic === 'vectors')).toBe(true);
  });

  it('does not invent sources for unrelated or empty queries', () => {
    expect(retrieveChunks('photosynthesis', documents)).toEqual([]);
    expect(retrieveChunks('the or and', documents)).toEqual([]);
    expect(retrieveChunks('matrix', documents, { topic: 'eigenvalues' })).toEqual([]);
  });
});
