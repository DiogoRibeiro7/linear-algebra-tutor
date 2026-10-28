/** Standalone Anna-window entrypoint that shares the existing math renderer. */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { BookOpen, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { MessageBubble } from '@/components/MessageBubble';
import {
  type ConversationSummary,
  type CourseChunk,
  type HintLevel,
  type TutorConversation,
  type TutorMessage,
} from './models';
import { loadCourseChunks } from './retrieval';
import { connectAnnaRuntime } from './runtime';
import { AnnaConversationStore } from './storage';
import { AnnaTutorService } from './tutor';

function newConversation(): TutorConversation {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: 'New conversation',
    created_at: now,
    updated_at: now,
    hint_level: 'medium',
    topic: null,
    messages: [],
  };
}

function makeMessage(role: 'user' | 'assistant', content: string): TutorMessage {
  return { id: crypto.randomUUID(), role, content, created_at: new Date().toISOString() };
}

export function AnnaApp() {
  const [store, setStore] = useState<AnnaConversationStore | null>(null);
  const [tutor, setTutor] = useState<AnnaTutorService | null>(null);
  const [chunks, setChunks] = useState<CourseChunk[]>([]);
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [active, setActive] = useState<TutorConversation | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function initialize(): Promise<void> {
      try {
        const [runtime, courseChunks] = await Promise.all([
          connectAnnaRuntime(),
          loadCourseChunks(),
        ]);
        const nextStore = new AnnaConversationStore(runtime.storage);
        const nextSummaries = await nextStore.listConversations();
        const nextActive = nextSummaries.length
          ? await nextStore.getConversation(nextSummaries[0].id)
          : null;
        if (cancelled) return;
        setStore(nextStore);
        setTutor(new AnnaTutorService(runtime, courseChunks));
        setChunks(courseChunks);
        setSummaries(nextSummaries);
        setActive(nextActive);
      } catch (failure: unknown) {
        if (!cancelled) setError(failure instanceof Error ? failure.message : 'Initialization failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages]);

  const topics = useMemo(() => [...new Set(chunks.map((chunk) => chunk.topic))]
    .filter(Boolean).sort(), [chunks]);

  async function persist(conversation: TutorConversation): Promise<void> {
    if (!store) throw new Error('Storage is unavailable');
    const nextSummaries = await store.saveConversation(conversation);
    setSummaries(nextSummaries);
    setActive(conversation);
  }

  async function createConversation(): Promise<void> {
    if (!store || busy) return;
    setError(null);
    try {
      await persist(newConversation());
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Unable to create conversation');
    }
  }

  async function selectConversation(id: string): Promise<void> {
    if (!store || busy) return;
    setError(null);
    try {
      const conversation = await store.getConversation(id);
      if (conversation) setActive(conversation);
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Unable to load conversation');
    }
  }

  async function updatePreference(patch: { hint_level?: HintLevel; topic?: string | null }): Promise<void> {
    if (!active || busy) return;
    setError(null);
    try {
      await persist({ ...active, ...patch, updated_at: new Date().toISOString() });
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Unable to save preference');
    }
  }

  async function removeConversation(): Promise<void> {
    if (!store || !active || busy) return;
    setBusy(true);
    setError(null);
    try {
      const nextSummaries = await store.deleteConversation(active.id);
      const next = nextSummaries.length
        ? await store.getConversation(nextSummaries[0].id) : null;
      setSummaries(nextSummaries);
      setActive(next);
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Unable to delete conversation');
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!active || !tutor || !store || busy || !input.trim()) return;
    setBusy(true);
    setError(null);
    const question = input.trim();
    const userMessage = makeMessage('user', question);
    try {
      // First persist the question; keep it available if generation fails.
      const withQuestion: TutorConversation = {
        ...active,
        title: active.messages.length === 0 ? question.slice(0, 60) : active.title,
        updated_at: new Date().toISOString(),
        messages: [...active.messages, userMessage],
      };
      await persist(withQuestion);
      setInput('');

      const answer = await tutor.answerQuestion(
        question, active.messages, active.hint_level, active.topic,
      );
      const assistantMessage = {
        ...makeMessage('assistant', answer.answer),
        metadata: { sources: answer.sources },
      };
      await persist({
        ...withQuestion,
        updated_at: new Date().toISOString(),
        messages: [...withQuestion.messages, assistantMessage],
      });
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Unable to answer the question');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div role="status" className="flex h-screen items-center justify-center gap-2">
      <Loader2 size={20} className="animate-spin" /> Connecting to Anna…
    </div>;
  }

  if (!store || !tutor) {
    return <div role="alert" className="p-6 text-red-700">
      Could not start Linear Algebra AI Tutor: {error || 'Anna is unavailable'}
    </div>;
  }

  return (
    <div className="flex h-screen min-h-0 bg-gray-50 text-gray-800">
      <aside aria-label="Conversations" className="flex w-56 flex-shrink-0 flex-col border-r bg-white sm:w-64">
        <div className="border-b px-3 py-4">
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <BookOpen size={18} /> Linear Algebra Tutor
          </h1>
          <p className="mt-1 text-xs text-gray-500">Anna edition · Socratic learning</p>
        </div>
        <button type="button" onClick={() => void createConversation()} disabled={busy}
          className="m-3 flex items-center justify-center gap-2 rounded bg-primary-500 px-3 py-2 text-white disabled:opacity-50">
          <Plus size={16} /> New conversation
        </button>
        <nav aria-label="Saved chats" className="flex-1 overflow-y-auto px-2">
          {summaries.map((summary) => (
            <button type="button" key={summary.id}
              onClick={() => void selectConversation(summary.id)} disabled={busy}
              aria-current={active?.id === summary.id ? 'page' : undefined}
              className={`mb-1 block w-full truncate rounded px-3 py-2 text-left text-sm disabled:opacity-50 ${
                active?.id === summary.id ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100'
              }`}>{summary.title}</button>
          ))}
        </nav>
        <p className="border-t px-3 py-2 text-xs text-gray-500">
          Conversations are stored in your Anna account.
        </p>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b bg-white px-4 py-3">
          <h2 className="mr-auto min-w-0 truncate font-medium">
            {active?.title || 'Select a conversation'}
          </h2>
          {active && <>
            <label htmlFor="anna-topic" className="text-xs text-gray-500">Topic</label>
            <select id="anna-topic" value={active.topic || ''} disabled={busy}
              onChange={(event) => void updatePreference({ topic: event.target.value || null })}
              className="rounded border px-2 py-1 text-sm">
              <option value="">All topics</option>
              {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
            </select>
            <label htmlFor="anna-hints" className="text-xs text-gray-500">Hints</label>
            <select id="anna-hints" value={active.hint_level} disabled={busy}
              onChange={(event) => void updatePreference({ hint_level: event.target.value as HintLevel })}
              className="rounded border px-2 py-1 text-sm">
              <option value="low">Minimal</option>
              <option value="medium">Standard</option>
              <option value="high">Generous</option>
            </select>
            <button type="button" aria-label="Delete conversation" title="Delete conversation"
              onClick={() => void removeConversation()} disabled={busy}
              className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-50">
              <Trash2 size={17} />
            </button>
          </>}
        </div>

        <section aria-label="Tutor messages" className="flex-1 overflow-y-auto px-4 py-5">
          {!active ? <div className="mx-auto mt-12 max-w-md text-center">
            <p className="text-lg">Ready to study linear algebra?</p>
            <p className="mt-2 text-sm text-gray-500">
              Start a conversation to explore concepts, equations, and guided problem solving.
            </p>
            <button type="button" className="mt-5 rounded bg-primary-500 px-4 py-2 text-white"
              onClick={() => void createConversation()}>Start learning</button>
          </div> : <div className="mx-auto max-w-4xl">
            {active.messages.length === 0 && <p className="mt-8 text-center text-sm text-gray-500">
              Try asking: What does an eigenvector represent geometrically?
            </p>}
            {active.messages.map((message) => <MessageBubble key={message.id} message={message} />)}
            {busy && <p role="status" className="text-sm text-gray-500">Working on your question…</p>}
            <div ref={messagesEndRef} />
          </div>}
        </section>

        {error && <div role="alert" className="border-t bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={(event) => void sendMessage(event)} className="border-t bg-white p-4">
          <div className="mx-auto flex max-w-4xl gap-2">
            <input aria-label="Ask a linear algebra question" value={input}
              onChange={(event) => setInput(event.target.value)} maxLength={4000}
              placeholder="Ask a question about linear algebra…"
              disabled={!active || busy}
              className="min-w-0 flex-1 rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100" />
            <button type="submit" disabled={!active || busy || !input.trim()}
              className="flex items-center gap-2 rounded bg-primary-500 px-4 py-2 text-white disabled:opacity-50">
              <Send size={17} /> Send
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-gray-500">
            Guided hints, not immediate answers. Check mathematical steps independently.
          </p>
        </form>
      </main>
    </div>
  );
}
