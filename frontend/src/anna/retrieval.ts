/** Lightweight retrieval over the material shipped with the Anna bundle. */
import { isCourseChunk, type CourseChunk } from './models';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'can', 'do', 'for', 'from',
  'how', 'i', 'in', 'is', 'it', 'me', 'of', 'on', 'or', 'the', 'to', 'what',
  'when', 'where', 'why', 'with', 'you', 'um', 'uma', 'o', 'os', 'as', 'de',
  'do', 'da', 'dos', 'das', 'em', 'e', 'para', 'por', 'que', 'como', 'se',
]);

/** Normalize accented English and Portuguese without losing mathematical numbers. */
export function tokenize(text: string): string[] {
  const normalized = text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return (normalized.match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((term) => !STOP_WORDS.has(term));
}

export interface RetrievedChunk {
  chunk: CourseChunk;
  score: number;
}

/** BM25 lexical fallback: explicit and testable, not MiniLM semantic search. */
export function retrieveChunks(
  query: string,
  allChunks: readonly CourseChunk[],
  options: { topK?: number; topic?: string | null } = {},
): RetrievedChunk[] {
  const terms = [...new Set(tokenize(query))];
  const topK = options.topK ?? 3;
  if (terms.length === 0 || !Number.isInteger(topK) || topK <= 0) return [];

  const selected = allChunks.filter((chunk) => !options.topic
    || chunk.topic.toLocaleLowerCase() === options.topic.toLocaleLowerCase());
  if (selected.length === 0) return [];

  const documentTerms = selected.map((chunk) => tokenize(chunk.content));
  const averageLength = documentTerms.reduce((sum, words) => sum + words.length, 0)
    / documentTerms.length || 1;
  const totalDocuments = selected.length;
  const k1 = 1.5;
  const b = 0.75;

  const scores = selected.map((chunk, index) => {
    const words = documentTerms[index];
    const frequency = new Map<string, number>();
    for (const word of words) frequency.set(word, (frequency.get(word) ?? 0) + 1);

    let score = 0;
    for (const term of terms) {
      const tf = frequency.get(term) ?? 0;
      if (tf === 0) continue;
      const documentFrequency = documentTerms.filter((doc) => doc.includes(term)).length;
      const idf = Math.log(1 + (totalDocuments - documentFrequency + 0.5)
        / (documentFrequency + 0.5));
      score += idf * tf * (k1 + 1)
        / (tf + k1 * (1 - b + b * words.length / averageLength));
    }
    return { chunk, score };
  });

  return scores.filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.chunk.id.localeCompare(right.chunk.id))
    .slice(0, topK);
}

/** Load only materials deliberately included at bundle build time. */
export async function loadCourseChunks(): Promise<CourseChunk[]> {
  const url = `${import.meta.env.BASE_URL}course-materials.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Course materials unavailable (${response.status})`);
  const data: unknown = await response.json();
  if (!Array.isArray(data) || data.length === 0 || !data.every(isCourseChunk)) {
    throw new Error('Invalid course-material index');
  }
  return data;
}
