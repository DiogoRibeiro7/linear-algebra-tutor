/** Lightweight retrieval over the material shipped with the Anna bundle. */
import { isCourseChunk, type CourseChunk } from './models';
import { canonicalTerm } from './terminology';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'can', 'do', 'for', 'from',
  'how', 'i', 'in', 'is', 'it', 'me', 'of', 'on', 'or', 'the', 'to', 'what',
  'when', 'where', 'why', 'with', 'you', 'um', 'uma', 'o', 'os', 'as', 'de',
  'do', 'da', 'dos', 'das', 'em', 'e', 'para', 'por', 'que', 'como', 'se',
  'qual', 'quais', 'sao', 'com', 'no', 'na', 'nos', 'nas', 'pelo', 'pela',
]);

// These verbs and teaching phrases occur throughout the lessons but provide
// no evidence that the student's actual subject is linear algebra.
const GENERIC_REQUEST_TERMS = new Set([
  'calculate', 'solve', 'find', 'explain', 'show', 'help', 'tell', 'please',
  'understand', 'know', 'mean', 'give', 'use', 'make', 'work', 'working',
  'example', 'examples', 'problem', 'problems', 'question', 'questions',
  'answer', 'answers', 'step', 'steps', 'method', 'methods', 'definition',
  'explicar', 'explica', 'explique', 'ajuda', 'ajudar', 'encontrar',
  'exemplo', 'exemplos', 'problema', 'problemas', 'pergunta', 'perguntas',
  'resposta', 'respostas', 'questao', 'questoes', 'passo', 'passos',
  'metodo', 'metodos', 'entender', 'usar', 'utilizar', 'fazer', 'dizer',
  'definicao',
]);

// Curated anchors from the shipped curriculum. Strong terms can identify a
// subject on their own; contextual terms are ambiguous in everyday requests
// (e.g. the rank of a sports team or a company's transformation).
const STRONG_COURSE_TERMS = new Set([
  'vector', 'matrix', 'scalar', 'basis', 'subspace', 'kernel', 'determinant',
  'eigenvalue', 'eigenvector', 'orthogonal', 'orthonormal', 'norm', 'span',
  'transpose', 'gaussian', 'spectral', 'gram', 'schmidt', 'pivot', 'nullity',
  'nullspace', 'diagonalizable', 'diagonalization', 'inverse', 'svd', 'qr',
  'ax',
]);

const CONTEXTUAL_COURSE_TERMS = new Set([
  'linear', 'system', 'equation', 'rank', 'transformation', 'projection',
  'least', 'square', 'independence', 'space', 'image', 'product',
  'addition', 'multiplication', 'inner', 'solution', 'elimination',
  'geometric', 'geometry', 'dimension', 'column', 'row', 'dot',
]);

/** Reject incidental keyword matches without claiming semantic classification. */
function hasCourseAnchor(terms: readonly string[]): boolean {
  if (terms.some((term) => STRONG_COURSE_TERMS.has(term))) return true;
  const contextualCount = terms.filter((term) => CONTEXTUAL_COURSE_TERMS.has(term)).length;
  return contextualCount >= 2 || (contextualCount === 1 && terms.length === 1);
}

/** Normalize accented English and Portuguese without losing mathematical numbers. */
export function tokenize(text: string): string[] {
  const normalized = text.toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bvalores?\s+proprios?\b/g, 'eigenvalue')
    .replace(/\bvetores?\s+proprios?\b/g, 'eigenvector');
  return (normalized.match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((term) => !STOP_WORDS.has(term))
    .map(canonicalTerm);
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
  const terms = [...new Set(tokenize(query).filter((term) => !GENERIC_REQUEST_TERMS.has(term)))];
  const topK = options.topK ?? 3;
  if (!hasCourseAnchor(terms) || !Number.isInteger(topK) || topK <= 0) return [];

  const selected = allChunks.filter((chunk) => !options.topic
    || chunk.topic.toLocaleLowerCase() === options.topic.toLocaleLowerCase());
  if (selected.length === 0) return [];

  const documentTerms = selected.map((chunk) => tokenize(chunk.content));
  const averageLength = documentTerms.reduce((sum, words) => sum + words.length, 0)
    / documentTerms.length || 1;
  const documentFrequencies = new Map<string, number>();
  for (const words of documentTerms) {
    // Count each term once per excerpt, as required by the BM25 IDF.
    for (const term of new Set(words)) {
      documentFrequencies.set(term, (documentFrequencies.get(term) ?? 0) + 1);
    }
  }
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
      const documentFrequency = documentFrequencies.get(term) ?? 0;
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
