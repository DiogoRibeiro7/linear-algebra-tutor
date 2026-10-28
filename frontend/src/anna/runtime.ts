/** Minimal, typed façade over the Anna Host API's granted capabilities. */
import { isRecord } from './models';

export interface AnnaLLMRequest {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens: number;
  temperature: number;
}

export interface AnnaLLMResponse {
  role: 'assistant';
  content: { type: 'text'; text: string };
  model: string;
  stopReason: string;
}

export interface AnnaStorage {
  get(args: { key: string }): Promise<{ value?: unknown; exists?: boolean; etag?: string }>;
  set(args: { key: string; value: unknown; if_match?: string }): Promise<unknown>;
  delete(args: { key: string }): Promise<unknown>;
  list(args: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    items: Array<{ key: string }>;
    next_cursor?: string | null;
  }>;
}

export interface AnnaRuntime {
  llm: { complete(request: AnnaLLMRequest): Promise<AnnaLLMResponse> };
  storage: AnnaStorage;
}

interface AnnaSdkModule {
  AnnaAppRuntime: { connect(): Promise<AnnaRuntime> };
}

function isSdkModule(value: unknown): value is AnnaSdkModule {
  if (!isRecord(value) || !isRecord(value.AnnaAppRuntime)) return false;
  return typeof value.AnnaAppRuntime.connect === 'function';
}

/**
 * The Anna host serves the SDK at this absolute URL inside its iframe.
 * A variable import prevents Vite from bundling a host-provided dependency.
 */
export async function connectAnnaRuntime(): Promise<AnnaRuntime> {
  const sdkUrl: string = '/static/anna-apps/_sdk/latest/index.js';
  const imported: unknown = await import(/* @vite-ignore */ sdkUrl);
  if (!isSdkModule(imported)) throw new Error('Anna SDK is unavailable');

  const runtime = await imported.AnnaAppRuntime.connect();
  if (!runtime?.llm || typeof runtime.llm.complete !== 'function'
    || !runtime.storage || typeof runtime.storage.get !== 'function'
    || typeof runtime.storage.set !== 'function'
    || typeof runtime.storage.delete !== 'function'
    || typeof runtime.storage.list !== 'function') {
    throw new Error('Required Anna LLM or storage permissions were not granted');
  }
  return runtime;
}
