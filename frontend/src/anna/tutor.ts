/** Anna-native answer generation, keeping retrieval separate from the model. */
import type { AnnaRuntime } from './runtime';
import type { CourseChunk, HintLevel, SourceReference, TutorMessage } from './models';
import { retrieveChunks, tokenize } from './retrieval';
import { systemPromptFor } from './prompts';

// These are character limits, not claims about the host model's tokenizer.
// Current questions and retrieved excerpts have separate limits and are never
// shortened by this history budget.
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CHARS = 6000;
const OMITTED_MIDDLE = '\n[Middle of earlier message omitted for context length]\n';

// A conservative vocabulary for questions that refer only to the immediately
// preceding answer. A new subject word (e.g. "photosynthesis" or "tax")
// disables citation carry-over, even if the question says "another example".
const FOLLOW_UP_WORDS = new Set([
  'about', 'again', 'another', 'answer', 'can', 'clearer', 'could', 'detail',
  'does', 'example', 'exercise', 'explain', 'full', 'give', 'help', 'hint',
  'how', 'its', 'keep', 'last', 'little', 'mathematical', 'more', 'my',
  'next', 'not', 'one', 'own', 'please', 'previous', 'question', 'reason',
  'reasoning', 'revealing', 'same', 'short', 'showing', 'similar', 'small',
  'solution', 'step', 'that', 'this', 'try', 'understand', 'valid', 'why',
  'without', 'work', 'works', 'would',
  'acontece', 'anterior', 'aquela', 'aquele', 'dar', 'dica', 'esse', 'essa',
  'este', 'esta', 'exercicio', 'explicar', 'funciona', 'mais', 'nao',
  'novamente', 'outra', 'outro', 'passo', 'percebi', 'pista', 'pode',
  'podes', 'porque', 'razao', 'revelar', 'resposta', 'sem', 'semelhante',
  'sobre', 'solucao', 'tentar', 'isso',
]);

const FOLLOW_UP_REFERENCES = new Set([
  'again', 'another', 'last', 'more', 'next', 'previous', 'same',
  'similar', 'that', 'this', 'anterior', 'aquela', 'aquele', 'esse',
  'essa', 'este', 'esta', 'mais', 'novamente', 'outra', 'outro',
  'semelhante', 'isso',
]);

type ModelMessage = { role: 'user' | 'assistant'; content: string };

/** Reuse evidence only for a brief, explicitly contextual follow-up. */
function isContextualFollowUp(question: string): boolean {
  const normalized = question.toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[.!?]+$/g, '').trim();
  if (['why', 'how', 'how so', 'what next', 'porque', 'como'].includes(normalized)) return true;

  const words = tokenize(question);
  return words.length > 0 && words.length <= 30
    && words.some((word) => FOLLOW_UP_REFERENCES.has(word))
    && words.every((word) => FOLLOW_UP_WORDS.has(word));
}

/** Resolve only the last assistant's exact, still-available course passages. */
function previousPassages(
  history: readonly TutorMessage[],
  courseChunks: readonly CourseChunk[],
  topic: string | null,
): CourseChunk[] {
  const question = history[history.length - 2];
  const reply = history[history.length - 1];
  if (question?.role !== 'user' || reply?.role !== 'assistant') return [];

  const byId = new Map(courseChunks.map((chunk) => [chunk.id, chunk]));
  const used = new Set<string>();
  const passages: CourseChunk[] = [];
  for (const reference of reply.metadata?.sources ?? []) {
    for (const id of reference.chunk_ids ?? []) {
      const chunk = byId.get(id);
      // Never substitute a changed or unrelated lesson for a saved source ID.
      if (!chunk || used.has(id) || chunk.source !== reference.source
        || chunk.type !== reference.type
        || (topic && chunk.topic.toLowerCase() !== topic.toLowerCase())) continue;
      used.add(id);
      passages.push(chunk);
      if (passages.length === 3) return passages;
    }
  }
  return passages;
}

/** Preserve the beginning and end of an oversized prior turn. */
function shortenEarlierMessage(content: string, maximum: number): string {
  if (content.length <= maximum) return content;
  if (maximum <= OMITTED_MIDDLE.length) return content.slice(0, maximum);

  const available = maximum - OMITTED_MIDDLE.length;
  const head = Math.ceil(available / 2);
  return content.slice(0, head) + OMITTED_MIDDLE + content.slice(-(available - head));
}

/**
 * Select only recent, complete student/assistant exchanges within a fixed
 * context budget. A long latest exchange is shortened so follow-up questions
 * still receive some context. Older exchanges remain intact or are excluded.
 * Saved conversations are not modified.
 */
function boundedHistory(history: readonly TutorMessage[]): ModelMessage[] {
  const selected: ModelMessage[] = [];
  let remaining = MAX_HISTORY_CHARS;

  for (let index = history.length - 1;
    index >= 1 && selected.length < MAX_HISTORY_MESSAGES; index -= 2) {
    const question = history[index - 1];
    const reply = history[index];
    if (question.role !== 'user' || reply.role !== 'assistant') break;

    let studentText = question.content;
    let assistantText = reply.content;
    if (studentText.length + assistantText.length > remaining) {
      // Only the newest pair is eligible for shortening. Do not displace it
      // with older, potentially unrelated history.
      if (selected.length > 0) break;
      // Keep the full assistant reply when it is short, while reserving at
      // least half the budget for each side if both are very long.
      const studentBudget = Math.min(
        studentText.length,
        Math.max(Math.floor(remaining / 2), remaining - assistantText.length),
      );
      studentText = shortenEarlierMessage(studentText, studentBudget);
      assistantText = shortenEarlierMessage(assistantText, remaining - studentBudget);
    }

    selected.unshift(
      { role: 'user', content: studentText },
      { role: 'assistant', content: assistantText },
    );
    remaining -= studentText.length + assistantText.length;
  }

  return selected;
}

export interface TutoringResponse {
  answer: string;
  sources: SourceReference[];
}

export class AnnaTutorService {
  constructor(
    private readonly runtime: AnnaRuntime,
    private readonly courseChunks: readonly CourseChunk[],
  ) {}

  async answerQuestion(
    question: string,
    history: readonly TutorMessage[],
    hintLevel: HintLevel,
    topic: string | null,
  ): Promise<TutoringResponse> {
    const trimmed = question.trim();
    if (!trimmed || trimmed.length > 4000) {
      throw new RangeError('Question must contain 1–4000 characters');
    }

    const directlyRetrieved = retrieveChunks(trimmed, this.courseChunks, { topic, topK: 3 })
      .map(({ chunk }) => chunk);
    const carriedPassages = directlyRetrieved.length === 0 && isContextualFollowUp(trimmed)
      ? previousPassages(history, this.courseChunks, topic) : [];
    const passages = directlyRetrieved.length > 0 ? directlyRetrieved : carriedPassages;
    const excerpts = passages.map((chunk, index) =>
      `[Source ${index + 1}: ${chunk.source}]\n${chunk.content}`);
    const context = excerpts.length > 0
      ? `${carriedPassages.length > 0
        ? 'Passages from the immediately preceding tutor answer'
        : 'Relevant course excerpts'} (reference only):\n${excerpts.join('\n\n')}`
      : 'No relevant course-material excerpt was found for this question.';

    // The current question is not yet in history. Keep paired recent turns
    // within budget; the active question and course evidence stay complete.
    const messages = boundedHistory(history);
    messages.push({
      role: 'user',
      content: `${context}\n\nStudent question:\n${trimmed}`,
    });

    const reply = await this.runtime.llm.complete({
      systemPrompt: systemPromptFor(hintLevel),
      messages,
      maxTokens: 1600,
      temperature: 0.4,
    });
    if (reply.role !== 'assistant' || reply.content?.type !== 'text'
      || !reply.content.text.trim()) {
      throw new Error('The model returned an invalid tutoring response');
    }
    if (reply.stopReason === 'maxTokens') {
      throw new Error('The model response was truncated; please try a smaller question');
    }

    const bySource = new Map<string, SourceReference>();
    for (const chunk of passages) {
      const prior = bySource.get(chunk.source);
      if (prior) {
        prior.chunk_ids?.push(chunk.id);
      } else {
        bySource.set(chunk.source, {
          source: chunk.source,
          type: chunk.type,
          chunk_ids: [chunk.id],
        });
      }
    }
    const sources = [...bySource.values()];
    return { answer: reply.content.text, sources };
  }
}
