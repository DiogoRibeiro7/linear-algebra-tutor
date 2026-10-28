import { describe, expect, it } from 'vitest';
import type { AnnaStorage } from './runtime';
import type { TutorConversation } from './models';
import { AnnaConversationStore } from './storage';

class MemoryStorage implements AnnaStorage {
  readonly values = new Map<string, unknown>();
  readonly versions = new Map<string, number>();
  pageSize = 100;
  failNextIndexSet = false;
  beforeNextIndexSet: (() => void) | null = null;

  /** Simulate APS data and its opaque revision token. */
  seed(key: string, value: unknown): void {
    this.values.set(key, value);
    this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
  }

  async get({ key }: { key: string }): Promise<{ value?: unknown; etag?: string }> {
    const version = this.versions.get(key);
    return { value: this.values.get(key), etag: version ? `revision-${version}` : undefined };
  }

  async set({ key, value, if_match }: {
    key: string; value: unknown; if_match?: string;
  }): Promise<void> {
    if (key.endsWith('/index') && this.failNextIndexSet) {
      this.failNextIndexSet = false;
      throw new Error('Index write interrupted');
    }
    if (key.endsWith('/index') && this.beforeNextIndexSet) {
      const mutation = this.beforeNextIndexSet;
      this.beforeNextIndexSet = null;
      mutation();
    }
    const version = this.versions.get(key);
    if (if_match !== undefined && if_match !== (version ? `revision-${version}` : undefined)) {
      throw Object.assign(new Error('Stale storage version'), { code: 'precondition_failed' });
    }
    this.seed(key, value);
  }

  async delete({ key }: { key: string }): Promise<void> {
    this.values.delete(key);
    this.versions.delete(key);
  }

  async list({ prefix = '', cursor, limit = 100 }: {
    prefix?: string; cursor?: string; limit?: number;
  }): Promise<{ items: Array<{ key: string }>; next_cursor?: string | null }> {
    const keys = [...this.values.keys()].filter((key) => key.startsWith(prefix)).sort();
    const offset = Number(cursor ?? 0);
    const nextOffset = offset + Math.min(limit, this.pageSize);
    return {
      items: keys.slice(offset, nextOffset).map((key) => ({ key })),
      next_cursor: nextOffset < keys.length ? String(nextOffset) : null,
    };
  }
}

function conversation(id: string): TutorConversation {
  return {
    id, title: `Conversation ${id}`, created_at: '2026-10-27T12:00:00Z',
    updated_at: '2026-10-27T12:00:00Z', hint_level: 'medium', topic: null, messages: [],
  };
}

describe('Anna persistent conversations', () => {
  it('creates, loads, updates, and deletes saved conversations', async () => {
    const storage = new AnnaConversationStore(new MemoryStorage());
    expect(await storage.listConversations()).toEqual([]);

    await storage.saveConversation(conversation('first'));
    await storage.saveConversation(conversation('second'));
    expect((await storage.listConversations()).map(({ id }) => id)).toEqual(['second', 'first']);

    const updated = { ...conversation('first'), title: 'Updated title' };
    await storage.saveConversation(updated);
    expect((await storage.listConversations()).length).toBe(2);
    expect((await storage.getConversation('first'))?.title).toBe('Updated title');

    const remaining = await storage.deleteConversation('second');
    expect(remaining.map(({ id }) => id)).toEqual(['first']);
    expect(await storage.getConversation('second')).toBeNull();
  });

  it('rejects malformed saved records', async () => {
    const memory = new MemoryStorage();
    const storage = new AnnaConversationStore(memory);
    memory.values.set('linear-algebra-tutor/v1/index', [{ id: 123 }]);
    await expect(storage.listConversations()).rejects.toThrow('invalid format');

    const invalidConversation = conversation('unsafe');
    memory.values.set('linear-algebra-tutor/v1/conversations/unsafe', {
      ...invalidConversation,
      messages: [{ id: 'm1', role: 'assistant', content: 'Reply',
        created_at: invalidConversation.created_at, metadata: { sources: 'not-an-array' } }],
    });
    await expect(storage.getConversation('unsafe')).rejects.toThrow('invalid format');

    memory.values.set('linear-algebra-tutor/v1/conversations/unsafe', {
      ...invalidConversation,
      messages: [{ id: 'm2', role: 'assistant', content: 'Reply',
        created_at: invalidConversation.created_at,
        metadata: { sources: [{ source: 'vectors.md', type: 'course_material', chunk_ids: [42] }] } }],
    });
    await expect(storage.getConversation('unsafe')).rejects.toThrow('invalid format');
  });

  it('loads legacy source references that do not include passage IDs', async () => {
    const memory = new MemoryStorage();
    const storage = new AnnaConversationStore(memory);
    memory.values.set('linear-algebra-tutor/v1/conversations/legacy', {
      ...conversation('legacy'),
      messages: [{ id: 'm3', role: 'assistant', content: 'Reply',
        created_at: '2026-10-27T12:00:00Z',
        metadata: { sources: [{ source: 'vectors.md', type: 'course_material' }] } }],
    });
    expect((await storage.getConversation('legacy'))?.messages[0].metadata?.sources)
      .toEqual([{ source: 'vectors.md', type: 'course_material' }]);
  });

  it('recovers a conversation saved before its index write failed', async () => {
    const memory = new MemoryStorage();
    const storage = new AnnaConversationStore(memory);
    memory.failNextIndexSet = true;

    await expect(storage.saveConversation(conversation('orphan')))
      .rejects.toThrow('Index write interrupted');
    expect(await storage.listConversations()).toEqual([]);
    expect(await storage.getConversation('orphan')).not.toBeNull();

    const recovered = await storage.recoverIndex();
    expect(recovered.map(({ id }) => id)).toEqual(['orphan']);
    const indexVersion = memory.versions.get('linear-algebra-tutor/v1/index');
    expect(await storage.recoverIndex()).toEqual(recovered);
    expect(memory.versions.get('linear-algebra-tutor/v1/index')).toBe(indexVersion);
  });

  it('removes a stale index entry when deletion succeeded before its index update failed', async () => {
    const memory = new MemoryStorage();
    const storage = new AnnaConversationStore(memory);
    await storage.saveConversation(conversation('deleted'));
    memory.failNextIndexSet = true;

    await expect(storage.deleteConversation('deleted'))
      .rejects.toThrow('Index write interrupted');
    expect((await storage.listConversations()).map(({ id }) => id)).toEqual(['deleted']);
    expect(await storage.getConversation('deleted')).toBeNull();
    expect(await storage.recoverIndex()).toEqual([]);
    expect(await storage.listConversations()).toEqual([]);
  });

  it('repairs a missing index across paginated listings within the app prefix', async () => {
    const memory = new MemoryStorage();
    memory.pageSize = 2;
    const storage = new AnnaConversationStore(memory);
    for (const id of ['one', 'two', 'three', 'four', 'five']) {
      memory.seed(`linear-algebra-tutor/v1/conversations/${id}`, conversation(id));
    }
    // A different application key must never become a tutoring conversation.
    memory.seed('unrelated-app/v1/conversations/other', conversation('other'));
    memory.seed('linear-algebra-tutor/v1/conversations/one/metadata', { ignored: true });

    const repaired = await storage.recoverIndex();
    expect(repaired.map(({ id }) => id).sort()).toEqual(['five', 'four', 'one', 'three', 'two']);
    expect(repaired.every(({ id }) => id !== 'other')).toBe(true);
  });

  it('retries a conflicting index revision without losing a concurrent conversation', async () => {
    const memory = new MemoryStorage();
    const storage = new AnnaConversationStore(memory);
    await storage.saveConversation(conversation('first'));
    memory.seed('linear-algebra-tutor/v1/conversations/concurrent', conversation('concurrent'));

    memory.beforeNextIndexSet = () => {
      const current: unknown = memory.values.get('linear-algebra-tutor/v1/index');
      if (!Array.isArray(current)) throw new TypeError('Expected a saved index');
      memory.seed('linear-algebra-tutor/v1/index', [
        ...current,
        { id: 'concurrent', title: 'Concurrent', updated_at: '2026-10-27T12:01:00Z' },
      ]);
    };
    await storage.saveConversation(conversation('second'));

    expect((await storage.listConversations()).map(({ id }) => id))
      .toEqual(['concurrent', 'second', 'first']);
  });

  it('preserves a conversation indexed concurrently with a recovery scan', async () => {
    const memory = new MemoryStorage();
    const storage = new AnnaConversationStore(memory);
    await storage.saveConversation(conversation('first'));
    memory.seed('linear-algebra-tutor/v1/conversations/orphan', conversation('orphan'));

    memory.beforeNextIndexSet = () => {
      memory.seed('linear-algebra-tutor/v1/conversations/later', conversation('later'));
      const current: unknown = memory.values.get('linear-algebra-tutor/v1/index');
      if (!Array.isArray(current)) throw new TypeError('Expected a saved index');
      memory.seed('linear-algebra-tutor/v1/index', [
        ...current,
        { id: 'later', title: 'Conversation later', updated_at: '2026-10-27T12:00:00Z' },
      ]);
    };

    const recovered = await storage.recoverIndex();
    expect(recovered.map(({ id }) => id).sort()).toEqual(['first', 'later', 'orphan']);
  });

  it('rejects repeated pagination cursors without rewriting the index', async () => {
    class RepeatingCursorStorage extends MemoryStorage {
      override async list(): Promise<{ items: Array<{ key: string }>; next_cursor: string }> {
        return { items: [], next_cursor: 'same-page' };
      }
    }

    const memory = new RepeatingCursorStorage();
    const storage = new AnnaConversationStore(memory);
    await expect(storage.recoverIndex()).rejects.toThrow('pagination cursor');
    expect(memory.values.has('linear-algebra-tutor/v1/index')).toBe(false);
  });
});
