/** User-scoped Anna Persistent Storage for tutoring conversations. */
import type { AnnaStorage } from './runtime';
import {
  isConversationSummary,
  isRecord,
  isTutorConversation,
  type ConversationSummary,
  type TutorConversation,
} from './models';

const INDEX_KEY = 'linear-algebra-tutor/v1/index';
const CONVERSATION_PREFIX = 'linear-algebra-tutor/v1/conversations/';
const LIST_PAGE_SIZE = 100;
const MAX_LIST_PAGES = 100;
const MAX_INDEX_ATTEMPTS = 3;

interface StoredIndex {
  summaries: ConversationSummary[];
  etag?: string;
}

function sortedSummaries(summaries: ConversationSummary[]): ConversationSummary[] {
  return summaries.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

function summaryOf(conversation: TutorConversation): ConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    updated_at: conversation.updated_at,
  };
}

function isPreconditionFailure(error: unknown): boolean {
  return isRecord(error) && (error.code === 'precondition_failed'
    || (isRecord(error.error) && error.error.code === 'precondition_failed'));
}

function sameSummaries(left: ConversationSummary[], right: ConversationSummary[]): boolean {
  return left.length === right.length && left.every((item, index) =>
    item.id === right[index].id && item.title === right[index].title
      && item.updated_at === right[index].updated_at);
}

export class AnnaConversationStore {
  constructor(private readonly storage: AnnaStorage) {}

  private async readIndex(): Promise<StoredIndex> {
    const response = await this.storage.get({ key: INDEX_KEY });
    if (response.value === undefined || response.value === null) {
      return { summaries: [], etag: response.etag };
    }
    if (!Array.isArray(response.value) || !response.value.every(isConversationSummary)) {
      throw new Error('Saved conversation index has an invalid format');
    }
    return {
      summaries: sortedSummaries([...response.value]),
      etag: response.etag,
    };
  }

  async listConversations(): Promise<ConversationSummary[]> {
    return (await this.readIndex()).summaries;
  }

  /** Update the secondary index without overwriting a newer version from another window. */
  private async updateIndex(
    transform: (summaries: ConversationSummary[]) => ConversationSummary[],
  ): Promise<ConversationSummary[]> {
    for (let attempt = 0; attempt < MAX_INDEX_ATTEMPTS; attempt += 1) {
      const { summaries, etag } = await this.readIndex();
      const next = sortedSummaries(transform(summaries));
      try {
        await this.storage.set({
          key: INDEX_KEY,
          value: next,
          ...(etag ? { if_match: etag } : {}),
        });
        return next;
      } catch (error: unknown) {
        if (!isPreconditionFailure(error) || attempt === MAX_INDEX_ATTEMPTS - 1) throw error;
      }
    }
    throw new Error('Conversation index changed repeatedly');
  }

  /** Enumerate only this app's conversation keys, including all APS list pages. */
  private async listStoredIds(): Promise<Set<string>> {
    const ids = new Set<string>();
    const seenCursors = new Set<string>();
    let cursor: string | undefined;

    for (let pageNumber = 0; pageNumber < MAX_LIST_PAGES; pageNumber += 1) {
      const response: unknown = await this.storage.list({
        prefix: CONVERSATION_PREFIX,
        limit: LIST_PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      });
      if (!isRecord(response) || !Array.isArray(response.items)
        || !response.items.every((item: unknown) =>
          isRecord(item) && typeof item.key === 'string'
          && item.key.startsWith(CONVERSATION_PREFIX))) {
        throw new Error('Anna storage returned an invalid conversation listing');
      }
      for (const item of response.items) {
        // Future sub-keys under this prefix are not conversation documents.
        const id = item.key.slice(CONVERSATION_PREFIX.length);
        if (id && !id.includes('/')) ids.add(id);
      }

      if (response.next_cursor === undefined || response.next_cursor === null) return ids;
      if (typeof response.next_cursor !== 'string' || !response.next_cursor
        || seenCursors.has(response.next_cursor)) {
        throw new Error('Anna storage returned an invalid pagination cursor');
      }
      cursor = response.next_cursor;
      seenCursors.add(cursor);
    }
    throw new Error('Anna storage conversation listing exceeded its page limit');
  }

  /** Repair incomplete save/delete operations without scanning other app data. */
  async recoverIndex(): Promise<ConversationSummary[]> {
    const storedIds = await this.listStoredIds();

    for (let attempt = 0; attempt < MAX_INDEX_ATTEMPTS; attempt += 1) {
      const { summaries, etag } = await this.readIndex();
      const merged = new Map(summaries.map((summary) => [summary.id, summary]));

      for (const id of storedIds) {
        if (!merged.has(id)) {
          const conversation = await this.getConversation(id);
          if (conversation) merged.set(id, summaryOf(conversation));
        }
      }
      for (const summary of summaries) {
        if (!storedIds.has(summary.id)) {
          // A concurrently created record may not be in the earlier listing.
          const conversation = await this.getConversation(summary.id);
          if (conversation) merged.set(summary.id, summaryOf(conversation));
          else merged.delete(summary.id);
        }
      }

      const repaired = sortedSummaries([...merged.values()]);
      if (sameSummaries(summaries, repaired)) return summaries;

      try {
        await this.storage.set({
          key: INDEX_KEY,
          value: repaired,
          ...(etag ? { if_match: etag } : {}),
        });
        return repaired;
      } catch (error: unknown) {
        if (!isPreconditionFailure(error) || attempt === MAX_INDEX_ATTEMPTS - 1) throw error;
      }
    }
    throw new Error('Conversation index changed repeatedly during recovery');
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

    return this.updateIndex((index) => [
      summaryOf(conversation),
      ...index.filter((existing) => existing.id !== conversation.id),
    ]);
  }

  async deleteConversation(id: string): Promise<ConversationSummary[]> {
    await this.storage.delete({ key: `${CONVERSATION_PREFIX}${id}` });
    return this.updateIndex((index) => index.filter((entry) => entry.id !== id));
  }
}
