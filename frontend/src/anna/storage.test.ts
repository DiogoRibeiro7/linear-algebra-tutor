import { describe, expect, it } from 'vitest';
import type { AnnaStorage } from './runtime';
import type { TutorConversation } from './models';
import { AnnaConversationStore } from './storage';

class MemoryStorage implements AnnaStorage {
  readonly values = new Map<string, unknown>();

  async get({ key }: { key: string }): Promise<{ value?: unknown }> {
    return { value: this.values.get(key) };
  }

  async set({ key, value }: { key: string; value: unknown }): Promise<void> {
    this.values.set(key, value);
  }

  async delete({ key }: { key: string }): Promise<void> {
    this.values.delete(key);
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
  });
});
