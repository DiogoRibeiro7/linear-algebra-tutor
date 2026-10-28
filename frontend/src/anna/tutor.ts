/** Anna-native answer generation, keeping retrieval separate from the model. */
import type { AnnaRuntime } from './runtime';
import type { CourseChunk, HintLevel, SourceReference, TutorMessage } from './models';
import { retrieveChunks } from './retrieval';
import { systemPromptFor } from './prompts';

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

    const retrieved = retrieveChunks(trimmed, this.courseChunks, { topic, topK: 3 });
    const excerpts = retrieved.map(({ chunk }, index) =>
      `[Source ${index + 1}: ${chunk.source}]\n${chunk.content}`);
    const context = excerpts.length > 0
      ? `Relevant course excerpts (reference only):\n${excerpts.join('\n\n')}`
      : 'No relevant course-material excerpt was found for this question.';

    // The current question is not yet in history. Avoid duplicate user turns.
    const messages = history.slice(-10).map((message) => ({
      role: message.role,
      content: message.content,
    }));
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

    const sources = [...new Map(retrieved.map(({ chunk }) => [chunk.source, {
      source: chunk.source,
      type: chunk.type,
    }])).values()];
    return { answer: reply.content.text, sources };
  }
}
