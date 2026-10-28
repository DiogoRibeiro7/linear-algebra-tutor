/** Contract tests using Anna's official mock Host API and manifest ACL. */
import { describe, expect, it } from 'vitest';
import { HostApiError, mountBundle, type MountedHarness } from '@anna-ai/cli/test';
import manifest from '../../../integrations/anna/manifest.json';
import { isRecord, type CourseChunk, type TutorConversation } from './models';
import type { AnnaLLMResponse, AnnaRuntime } from './runtime';
import { AnnaConversationStore } from './storage';
import { AnnaTutorService } from './tutor';

const courseChunks: CourseChunk[] = [{
  id: 'chapter7_eigenvalues.md#1',
  source: 'chapter7_eigenvalues.md',
  type: 'course_material',
  topic: 'eigenvalues and eigenvectors',
  chapter: '7',
  content: 'An eigenvector is a nonzero vector satisfying Av = lambda v.',
}];

/** Adapt the official harness dispatch interface to our production SDK façade. */
function runtimeFromHarness(harness: MountedHarness): AnnaRuntime {
  return {
    llm: {
      complete: (request) => harness.runtime.call<AnnaLLMResponse>('llm', 'complete', request),
    },
    storage: {
      get: (args) => harness.runtime.call('storage', 'get', args),
      set: (args) => harness.runtime.call('storage', 'set', args),
      delete: (args) => harness.runtime.call('storage', 'delete', args),
    },
  };
}

function requireKey(args: unknown): string {
  if (!isRecord(args) || typeof args.key !== 'string') {
    throw new TypeError('Anna storage request requires a string key');
  }
  return args.key;
}

function savedConversation(): TutorConversation {
  return {
    id: 'lesson-one',
    title: 'Eigenvectors',
    created_at: '2026-10-28T10:00:00Z',
    updated_at: '2026-10-28T10:00:00Z',
    hint_level: 'medium',
    topic: 'eigenvalues and eigenvectors',
    messages: [{
      id: 'question-one',
      role: 'user',
      content: 'What is an eigenvector?',
      created_at: '2026-10-28T10:00:00Z',
    }],
  };
}

describe('Anna host contract', () => {
  it('grants only LLM completion and the declared storage methods', async () => {
    const harness = await mountBundle({ manifest });
    expect([...harness.acl.allowed].sort()).toEqual([
      'llm.complete', 'storage.delete', 'storage.get', 'storage.list', 'storage.set',
    ]);

    await expect(harness.runtime.call('fs', 'read', { path: 'private.txt' }))
      .rejects.toBeInstanceOf(HostApiError);
    expect(harness.calls.lastOf('fs.read')?.outcome).toBe('denied');
  });

  it('round-trips conversations through production-shaped APS responses', async () => {
    const data = new Map<string, unknown>();
    const harness = await mountBundle({
      manifest,
      mocks: {
        // The official test harness defaults to returning bare values from
        // storage.get; production instead wraps values in { value, exists }.
        'storage.get': (args: unknown) => {
          const key = requireKey(args);
          return { value: data.get(key) ?? null, exists: data.has(key) };
        },
        'storage.set': (args: unknown) => {
          const key = requireKey(args);
          if (!isRecord(args)) throw new TypeError('Expected storage parameters');
          data.set(key, args.value);
          return { etag: 'fixture', generation: 1 };
        },
        'storage.delete': (args: unknown) => {
          data.delete(requireKey(args));
          return { deleted: true };
        },
      },
    });
    const store = new AnnaConversationStore(runtimeFromHarness(harness).storage);

    expect(await store.listConversations()).toEqual([]);
    await store.saveConversation(savedConversation());
    expect((await store.getConversation('lesson-one'))?.messages[0].content)
      .toBe('What is an eigenvector?');
    expect((await store.listConversations()).map(({ id }) => id)).toEqual(['lesson-one']);
    expect(harness.calls.byNs('storage.set')).toHaveLength(2);

    await store.deleteConversation('lesson-one');
    expect(await store.getConversation('lesson-one')).toBeNull();
    expect(harness.calls.lastOf('storage.delete')?.outcome).toBe('ok');
  });

  it('grounds a Socratic completion in the retrieved chapter using the host API', async () => {
    const harness = await mountBundle({
      manifest,
      mocks: {
        'llm.complete': (args: unknown) => {
          if (!isRecord(args) || typeof args.systemPrompt !== 'string') {
            throw new TypeError('Expected a Socratic system prompt');
          }
          return {
            role: 'assistant',
            content: { type: 'text', text: 'How would you check whether Av = λv?' },
            model: 'anna-mock',
            stopReason: 'endTurn',
          } satisfies AnnaLLMResponse;
        },
      },
    });

    const tutor = new AnnaTutorService(runtimeFromHarness(harness), courseChunks);
    const response = await tutor.answerQuestion('What is an eigenvector?', [], 'low', null);
    expect(response.answer).toContain('How would you check');
    expect(response.sources).toEqual([{
      source: 'chapter7_eigenvalues.md', type: 'course_material',
    }]);

    const request = harness.calls.lastOf('llm.complete')?.args;
    expect(request).toMatchObject({
      maxTokens: 1600,
      temperature: 0.4,
      messages: [{ role: 'user' }],
    });
    expect(isRecord(request) && request.systemPrompt).toContain('Minimal hints');
    expect(harness.calls.lastOf('llm.complete')?.outcome).toBe('ok');
  });

  it('rejects model calls when the manifest does not grant LLM access', async () => {
    const restricted = {
      ...manifest,
      ui: {
        ...manifest.ui,
        host_api: { ...manifest.ui.host_api, llm: [] },
      },
    };
    const harness = await mountBundle({ manifest: restricted });
    const tutor = new AnnaTutorService(runtimeFromHarness(harness), courseChunks);

    await expect(tutor.answerQuestion('eigenvector', [], 'medium', null))
      .rejects.toBeInstanceOf(HostApiError);
    expect(harness.calls.lastOf('llm.complete')?.outcome).toBe('denied');
  });
});
