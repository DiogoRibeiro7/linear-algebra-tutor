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

/** Curated first questions matched to the eight bundled course chapters. */
const DEFAULT_STARTERS: readonly string[] = [
  'What does a vector represent geometrically?',
  'How can I solve a 2×2 linear system using elimination?',
  'What makes an eigenvector special?',
];

const TOPIC_STARTERS: Readonly<Record<string, readonly string[]>> = {
  vectors: [
    'How do I calculate the magnitude of the vector (3, 4)?',
    'Why does the dot product help identify perpendicular vectors?',
  ],
  matrices: [
    'Can you guide me through multiplying two 2×2 matrices?',
    'How can I determine the rank of a matrix?',
  ],
  'linear systems': [
    'Help me solve x + y = 3 and 2x - y = 0 using elimination.',
    'How can I tell whether a linear system has infinitely many solutions?',
  ],
  'subspaces and bases': [
    'How can I check whether two vectors form a basis of R²?',
    'What does the rank-nullity theorem tell us?',
  ],
  'linear transformations': [
    'How can I test whether T(x, y) = (x + y, 2y) is linear?',
    'How are the kernel and image of a transformation related to its matrix?',
  ],
  determinants: [
    'Why does a zero determinant mean a matrix is not invertible?',
    'Can you guide me through finding a 3×3 determinant using row operations?',
  ],
  'eigenvalues and eigenvectors': [
    'How can I find the eigenvalues of the matrix [[2, 1], [1, 2]]?',
    'What does an eigenvector mean geometrically?',
  ],
  'orthogonality and least squares': [
    'How do I project one vector onto another?',
    'Why can least squares be understood as a projection?',
  ],
};

interface FollowUpSuggestion {
  label: string;
  question: string;
}

/** Follow-up drafts deliberately reference the previous solved turn. */
const FOLLOW_UP_SUGGESTIONS: readonly FollowUpSuggestion[] = [
  {
    label: 'Another hint',
    question: 'Could you give me one more small hint about the previous question without revealing the full solution?',
  },
  {
    label: 'Explain the reasoning',
    question: 'Can you explain why the previous mathematical step is valid?',
  },
  {
    label: 'Try a similar exercise',
    question: 'Can you give me a similar exercise to try on my own, without showing its solution?',
  },
];

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
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeNavigationButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const keepConversationButtonRef = useRef<HTMLButtonElement>(null);
  const activeTitleRef = useRef<HTMLHeadingElement>(null);

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
    // Make the non-destructive action the first keyboard choice.
    if (deleteTargetId && deleteTargetId === active?.id) {
      keepConversationButtonRef.current?.focus();
    }
  }, [deleteTargetId, active?.id]);

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
  const starters = active?.topic ? TOPIC_STARTERS[active.topic] ?? DEFAULT_STARTERS
    : DEFAULT_STARTERS;

  function closeNavigation(): void {
    setNavigationOpen(false);
    menuButtonRef.current?.focus();
  }

  function resetDraft(): void {
    setInput('');
    setEditingPending(false);
  }

  /** Suggested questions remain editable and never make a model call on selection. */
  function fillSuggestedDraft(question: string): void {
    setInput(question);
    questionInputRef.current?.focus();
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
      setDeleteTargetId(null);
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
        setDeleteTargetId(null);
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

  function cancelConversationDeletion(): void {
    setDeleteTargetId(null);
    deleteButtonRef.current?.focus();
  }

  /** Only a second, explicit action may delete the originally selected chat. */
  async function removeConversation(): Promise<void> {
    if (!store || !active || busy || deleteTargetId !== active.id) return;
    setBusy(true);
    setError(null);
    try {
      const nextSummaries = await store.deleteConversation(active.id);
      const next = nextSummaries.length
        ? await store.getConversation(nextSummaries[0].id) : null;
      setSummaries(nextSummaries);
      setActive(next);
      setDeleteTargetId(null);
      resetDraft();
      activeTitleRef.current?.focus();
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
          <h2 ref={activeTitleRef} tabIndex={-1} className="mr-auto min-w-0 truncate font-medium">
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
            <button type="button" ref={deleteButtonRef} aria-label="Delete conversation"
              title="Delete conversation" aria-expanded={deleteTargetId === active.id}
              aria-controls="anna-delete-confirmation"
              onClick={() => setDeleteTargetId(active.id)} disabled={busy}
              className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-50">
              <Trash2 size={17} />
            </button>
          </>}
        </div>

        {active && deleteTargetId === active.id && <div id="anna-delete-confirmation"
          role="group" aria-label="Confirm conversation deletion"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelConversationDeletion();
            }
          }}
          className="flex flex-wrap items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-3 text-sm">
          <p role="alert" className="min-w-0 flex-1 text-red-900">
            Delete “{active.title}”? This permanently removes the conversation from your Anna account.
          </p>
          <button type="button" ref={keepConversationButtonRef}
            onClick={cancelConversationDeletion} disabled={busy}
            className="rounded border border-gray-300 bg-white px-3 py-2 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500">
            Keep conversation
          </button>
          <button type="button" onClick={() => void removeConversation()} disabled={busy}
            className="rounded bg-red-700 px-3 py-2 text-white hover:bg-red-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700">
            Delete permanently
          </button>
        </div>}

        <section aria-label="Tutor messages" className="flex-1 overflow-y-auto px-4 py-5">
          {!active ? <div className="mx-auto mt-12 max-w-md text-center">
            <p className="text-lg">Ready to study linear algebra?</p>
            <p className="mt-2 text-sm text-gray-500">
              Start a conversation to explore concepts, equations, and guided problem solving.
            </p>
            <button type="button" className="mt-5 rounded bg-primary-500 px-4 py-2 text-white"
              onClick={() => void createConversation()}>Start learning</button>
          </div> : <div className="mx-auto max-w-4xl">
            {active.messages.length === 0 && !input.trim() && <div className="mx-auto mt-8 max-w-2xl">
              <p className="text-center text-sm text-gray-600">
                Choose a starting question or write your own.
              </p>
              <div role="group" aria-label="Suggested starting questions"
                className="mt-4 grid gap-2 sm:grid-cols-2">
                {starters.map((question) => <button type="button" key={question}
                  onClick={() => fillSuggestedDraft(question)}
                  className="rounded border bg-white px-3 py-3 text-left text-sm hover:border-primary-500 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500">
                  {question}
                </button>)}
              </div>
              <p className="mt-3 text-center text-xs text-gray-500">
                Edit the question if needed; nothing is sent until you press Send.
              </p>
            </div>}
            {active.messages.map((message) => <MessageBubble key={message.id} message={message}
              sourceEvidence={sourceEvidence} />)}
            {lastMessage?.role === 'assistant' && !input.trim() && !busy && <div
              className="my-5 rounded border border-gray-200 bg-white p-3">
              <p className="text-sm text-gray-700">How would you like to continue?</p>
              <div role="group" aria-label="Suggested follow-up questions"
                className="mt-2 flex flex-wrap gap-2">
                {FOLLOW_UP_SUGGESTIONS.map(({ label, question }) => <button type="button" key={label}
                  onClick={() => fillSuggestedDraft(question)}
                  className="rounded border border-primary-200 px-3 py-2 text-left text-sm text-primary-700 hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500">
                  {label}
                </button>)}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Choosing one only fills the draft. You can edit it before sending.
              </p>
            </div>}
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
