/** Domain types shared by Anna's UI, retrieval, and persistence. */
export type HintLevel = 'low' | 'medium' | 'high';

export interface CourseChunk {
  id: string;
  source: string;
  type: 'course_material' | 'code_example';
  topic: string;
  chapter: string | null;
  content: string;
}

export interface SourceReference {
  source: string;
  type: string;
}

export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  metadata?: { sources?: SourceReference[] };
}

export interface TutorConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  hint_level: HintLevel;
  topic: string | null;
  messages: TutorMessage[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
}

/** Guard against malformed remote responses and previously saved data. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isCourseChunk(value: unknown): value is CourseChunk {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.source === 'string'
    && (value.type === 'course_material' || value.type === 'code_example')
    && typeof value.topic === 'string'
    && (value.chapter === null || typeof value.chapter === 'string')
    && typeof value.content === 'string';
}

export function isTutorMessage(value: unknown): value is TutorMessage {
  if (!isRecord(value)) return false;
  const metadata = value.metadata;
  const sourcesValid = !isRecord(metadata) || metadata.sources === undefined
    || (Array.isArray(metadata.sources) && metadata.sources.every((source: unknown) =>
      isRecord(source) && typeof source.source === 'string'
      && typeof source.type === 'string'));
  return typeof value.id === 'string'
    && (value.role === 'user' || value.role === 'assistant')
    && typeof value.content === 'string'
    && typeof value.created_at === 'string'
    && (metadata === undefined || isRecord(metadata))
    && sourcesValid;
}

export function isTutorConversation(value: unknown): value is TutorConversation {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.created_at === 'string'
    && typeof value.updated_at === 'string'
    && ['low', 'medium', 'high'].includes(String(value.hint_level))
    && (value.topic === null || typeof value.topic === 'string')
    && Array.isArray(value.messages)
    && value.messages.every(isTutorMessage);
}

export function isConversationSummary(value: unknown): value is ConversationSummary {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.updated_at === 'string';
}
