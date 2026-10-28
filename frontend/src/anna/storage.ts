/** User-scoped Anna Persistent Storage for tutoring conversations. */
import type { AnnaStorage } from './runtime';
import {
  isConversationSummary,
  isTutorConversation,
  type ConversationSummary,
  type TutorConversation,
} from './models';

const INDEX_KEY = 'linear-algebra-tutor/v1/index';
const CONVERSATION_PREFIX = 'linear-algebra-tutor/v1/conversations/';

export class AnnaConversationStore {
  constructor(private readonly storage: AnnaStorage) {}

  async listConversations(): Promise<ConversationSummary[]> {
    const response = await this.storage.get({ key: INDEX_KEY });
    if (response.value === undefined || response.value === null) return [];
    if (!Array.isArray(response.value) || !response.value.every(isConversationSummary)) {
      throw new Error('Saved conversation index has an invalid format');
    }
    return response.value.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async getConversation(id: string): Promise<TutorConversation | null> {
    const response = await this.storage.get({ key: `${CONVERSATION_PREFIX}${id}` });
    if (response.value === undefined || response.value === null) return null;
    if (!isTutorConversation(response.value) || response.value.id !== id) {
      throw new Error('Saved conversation has an invalid format');
    }
    return response.value;
  }

  async saveConversation(conversation: TutorConversation): Promise<ConversationSummary[]> {
    if (!isTutorConversation(conversation)) throw new TypeError('Invalid conversation');
    await this.storage.set({
      key: `${CONVERSATION_PREFIX}${conversation.id}`,
      value: conversation,
    });

    const index = await this.listConversations();
    const summaries = [
      {
        id: conversation.id,
        title: conversation.title,
        updated_at: conversation.updated_at,
      },
      ...index.filter((existing) => existing.id !== conversation.id),
    ].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    await this.storage.set({ key: INDEX_KEY, value: summaries });
    return summaries;
  }

  async deleteConversation(id: string): Promise<ConversationSummary[]> {
    const index = await this.listConversations();
    await this.storage.delete({ key: `${CONVERSATION_PREFIX}${id}` });
    const remaining = index.filter((entry) => entry.id !== id);
    await this.storage.set({ key: INDEX_KEY, value: remaining });
    return remaining;
  }
}
