/** Standalone Anna-window entrypoint that shares the existing math renderer. */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { BookOpen, Loader2, Menu, Plus, Send, Trash2, X } from 'lucide-react';
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
  const [editingPending, setEditingPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeNavigationButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function initialize(): Promise<void> {
      try {
        const [runtime, courseChunks] = await Promise.all([
          connectAnnaRuntime(),
          loadCourseChunks(),
        ]);
        const nextStore = new AnnaConversationStore(runtime.storage);
        // Recover records from interrupted two-step writes before selecting a chat.
        const nextSummaries = await nextStore.recoverIndex();
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

  useEffect(() => {
    if (editingPending) questionInputRef.current?.focus();
  }, [editingPending]);

  useEffect(() => {
    if (!navigationOpen) return;

    // Keep the mobile drawer keyboard-accessible and return focus on Escape.
    closeNavigationButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setNavigationOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigationOpen]);

  const topics = useMemo(() => [...new Set(chunks.map((chunk) => chunk.topic))]
    .filter(Boolean).sort(), [chunks]);
  const sourceEvidence = useMemo(() => new Map(chunks.map(({ id, source, content }) => [
    id, { source, content },
  ] as const)), [chunks]);
  const lastMessage = active?.messages[active.messages.length - 1];
  const hasUnansweredQuestion = lastMessage?.role === 'user';

  function closeNavigation(): void {
    setNavigationOpen(false);
    menuButtonRef.current?.focus();
  }

  function resetDraft(): void {
    setInput('');
    setEditingPending(false);
  }

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
      resetDraft();
      closeNavigation();
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Unable to create conversation');
    }
  }

  async function selectConversation(id: string): Promise<void> {
    if (!store || busy) return;
    setError(null);
    try {
      const conversation = await store.getConversation(id);
      if (conversation) {
        setActive(conversation);
        resetDraft();
        closeNavigation();
      }
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
      resetDraft();
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Unable to delete conversation');
    } finally {
      setBusy(false);
    }
  }

  /** Complete a persisted user turn without appending that question again. */
  async function answerUnansweredQuestion(conversation: TutorConversation): Promise<void> {
    if (!tutor) throw new Error('Tutor is unavailable');
    const question = conversation.messages[conversation.messages.length - 1];
    if (!question || question.role !== 'user') {
      throw new Error('The conversation has no unanswered question');
    }

    // The current question is already stored, so exclude it from model history.
    const answer = await tutor.answerQuestion(
      question.content,
      conversation.messages.slice(0, -1),
      conversation.hint_level,
      conversation.topic,
    );
    const assistantMessage = {
      ...makeMessage('assistant', answer.answer),
      metadata: { sources: answer.sources },
    };
    await persist({
      ...conversation,
      updated_at: new Date().toISOString(),
      messages: [...conversation.messages, assistantMessage],
    });
  }

  /** Recover an interrupted model turn, including after reopening the Anna window. */
  async function retryLastAnswer(): Promise<void> {
    if (!active || !store || !tutor || busy || !hasUnansweredQuestion || editingPending) return;
    setBusy(true);
    setError(null);
    try {
      await answerUnansweredQuestion(active);
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Unable to retry the answer');
    } finally {
      setBusy(false);
    }
  }

  /** Keep the saved pending turn intact until the student submits a revision. */
  function startEditingPending(): void {
    if (!hasUnansweredQuestion || !lastMessage || busy) return;
    setInput(lastMessage.content);
    setEditingPending(true);
  }

  function cancelEditingPending(): void {
    setEditingPending(false);
    setInput('');
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!active || !tutor || !store || busy || !input.trim()) return;
    // A failed model call leaves a saved user turn. Never append a second one
    // until that turn has been answered or deliberately revised.
    if (hasUnansweredQuestion && !editingPending) return;
    if (editingPending && (!hasUnansweredQuestion || !lastMessage)) return;
    setBusy(true);
    setError(null);
    const question = input.trim();
    const revising = hasUnansweredQuestion && editingPending && lastMessage;
    const userMessage = revising
      ? { ...lastMessage, content: question }
      : makeMessage('user', question);
    try {
      // Persist the revised turn in place before invoking the model. A failed
      // model call still leaves exactly one recoverable unanswered question.
      const messages = revising
        ? [...active.messages.slice(0, -1), userMessage]
        : [...active.messages, userMessage];
      const withQuestion: TutorConversation = {
        ...active,
        // A multiline equation should remain readable in the chat list.
        title: messages.length === 1 ? question.replace(/\s+/g, ' ').slice(0, 60) : active.title,
        updated_at: new Date().toISOString(),
        messages,
      };
      await persist(withQuestion);
      setInput('');
      setEditingPending(false);

      await answerUnansweredQuestion(withQuestion);
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
    <div className="flex h-screen min-h-0 overflow-hidden bg-gray-50 text-gray-800">
      {navigationOpen && <button type="button" aria-label="Close navigation overlay"
        onClick={closeNavigation}
        className="fixed inset-0 z-20 bg-black/40 md:hidden" />}
      <aside id="anna-conversations" aria-label="Conversations"
        className={`${navigationOpen ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-30 w-72 max-w-[85vw] flex-shrink-0 flex-col border-r bg-white shadow-lg md:static md:z-auto md:flex md:w-64 md:max-w-none md:shadow-none`}>
        <div className="flex items-start justify-between gap-2 border-b px-3 py-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-base font-semibold">
              <BookOpen size={18} /> Linear Algebra Tutor
            </h1>
            <p className="mt-1 text-xs text-gray-500">Anna edition · Socratic learning</p>
          </div>
          <button type="button" ref={closeNavigationButtonRef} aria-label="Close conversations"
            onClick={closeNavigation}
            className="rounded p-1 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 md:hidden">
            <X size={20} />
          </button>
        </div>
        <button type="button" aria-label="Create conversation"
          onClick={() => void createConversation()} disabled={busy}
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
          <button type="button" ref={menuButtonRef} aria-label="Open conversations"
            aria-expanded={navigationOpen} aria-controls="anna-conversations"
            onClick={() => setNavigationOpen(true)}
            className="rounded p-1 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 md:hidden">
            <Menu size={20} />
          </button>
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
            {active.messages.map((message) => <MessageBubble key={message.id} message={message}
              sourceEvidence={sourceEvidence} />)}
            {hasUnansweredQuestion && !busy && <div className="my-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="text-amber-900">This question has not received a tutor answer.</p>
              {editingPending ? <>
                <p className="mt-1 text-amber-900">
                  Edit the pending question below, then send it to replace the saved version.
                </p>
                <button type="button" onClick={cancelEditingPending}
                  className="mt-2 rounded border border-amber-400 px-3 py-2 text-amber-900 hover:bg-amber-100">
                  Cancel edit
                </button>
              </> : <>
                <p className="mt-1 text-amber-900">Resolve this turn before asking another question.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void retryLastAnswer()}
                    className="rounded bg-primary-500 px-3 py-2 text-white hover:bg-primary-600">
                    Retry answer
                  </button>
                  <button type="button" onClick={startEditingPending}
                    className="rounded border border-amber-400 px-3 py-2 text-amber-900 hover:bg-amber-100">
                    Edit question
                  </button>
                </div>
                <p className="mt-2 text-xs text-amber-800">Retrying may use another Anna model call.</p>
              </>}
            </div>}
            {busy && <p role="status" className="text-sm text-gray-500">Working on your question…</p>}
            <div ref={messagesEndRef} />
          </div>}
        </section>

        {error && <div role="alert" className="border-t bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
        <form onSubmit={(event) => void sendMessage(event)} className="border-t bg-white p-4">
          <div className="mx-auto flex max-w-4xl gap-2">
            <textarea ref={questionInputRef} aria-label="Ask a linear algebra question"
              aria-describedby="anna-compose-help" value={input} rows={2}
              onChange={(event) => setInput(event.target.value)} maxLength={4000}
              onKeyDown={(event) => {
                // Shift+Enter inserts a line break for matrices or LaTeX.
                // IME composition must not accidentally submit a question.
                if (event.key === 'Enter' && !event.shiftKey && !event.altKey
                  && !event.ctrlKey && !event.metaKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={editingPending ? 'Revise the unanswered question…' : 'Ask a question about linear algebra…'}
              disabled={!active || busy || (hasUnansweredQuestion && !editingPending)}
              className="min-h-14 max-h-36 min-w-0 flex-1 resize-y rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100" />
            <button type="submit" disabled={!active || busy || !input.trim()
              || (hasUnansweredQuestion && !editingPending)}
              className="flex items-center gap-2 rounded bg-primary-500 px-4 py-2 text-white disabled:opacity-50">
              <Send size={17} /> {editingPending ? 'Resend' : 'Send'}
            </button>
          </div>
          <p id="anna-compose-help" className="mt-2 text-center text-xs text-gray-500">
            Enter to send · Shift+Enter for a new line. Check mathematical steps independently.
          </p>
        </form>
      </main>
    </div>
  );
}
