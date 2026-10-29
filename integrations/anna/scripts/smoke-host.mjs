/**
 * Smoke-check the official Anna local host (mock LLM, no account or quota).
 * Run with `ANNA_MOCK_HOST_URL=http://127.0.0.1:5180 node scripts/smoke-host.mjs`
 * after starting `anna-app dev` with the fixture in this directory.
 */
import assert from 'node:assert/strict';

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value @param {string} property @returns {string} */
function stringField(value, property) {
  if (!isRecord(value) || typeof value[property] !== 'string') {
    throw new TypeError(`Expected a string ${property} from the Anna host`);
  }
  return value[property];
}

/**
 * Use localhost only: the session request contains a temporary bearer token.
 * @param {URL} base
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
async function jsonRequest(base, path, options = {}) {
  const response = await fetch(new URL(path, base), options);
  if (!response.ok) throw new Error(`Anna host ${path} returned HTTP ${response.status}`);
  const value = /** @type {unknown} */ (await response.json());
  if (!isRecord(value)) throw new TypeError(`Invalid response for ${path}`);
  return value;
}

/** @param {URL} base @param {string} sessionId @param {string} ns @param {string} method @param {Record<string, unknown>} args */
async function hostCall(base, sessionId, ns, method, args) {
  return jsonRequest(base, '/api/session/call', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, ns, method, args }),
  });
}

async function main() {
  const base = new URL(process.env.ANNA_MOCK_HOST_URL ?? 'http://127.0.0.1:5180');
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(base.hostname)) {
    throw new Error('The smoke test only connects to a local HTTP Anna harness');
  }

  const config = await jsonRequest(base, '/api/config');
  const path = stringField(config, 'bundle_base');
  assert.equal(stringField(config, 'app_slug'), 'linear-algebra-ai-tutor');
  assert.ok(path.startsWith('/anna-apps/'), 'unexpected bundle route');

  const session = await jsonRequest(base, '/api/session/create', { method: 'POST' });
  const sessionId = stringField(session, 'session_id');
  const windowUuid = stringField(session, 'window_uuid');
  const token = stringField(session, 'token');

  // Ensure the static bundle and generated course index are available via
  // the real harness routes, not only in the frontend build directory.
  const entry = new URL(path, base);
  entry.search = new URLSearchParams({ wid: windowUuid, t: token }).toString();
  const html = await fetch(entry);
  assert.equal(html.status, 200, 'Anna must serve the React entrypoint');
  assert.match(await html.text(), /id="root"/);

  const materialResponse = await fetch(new URL('course-materials.json', entry));
  assert.equal(materialResponse.status, 200, 'Anna must serve the course index');
  const materials = /** @type {unknown} */ (await materialResponse.json());
  assert.ok(Array.isArray(materials) && materials.length >= 8);

  const key = `linear-algebra-tutor/smoke/${crypto.randomUUID()}`;
  try {
    const stored = await hostCall(base, sessionId, 'storage', 'set', {
      key, value: { lesson: 'eigenvectors' },
    });
    assert.equal(stored.ok, true, 'Anna rejected a granted storage.set');

    const read = await hostCall(base, sessionId, 'storage', 'get', { key });
    assert.equal(read.ok, true, 'Anna rejected a granted storage.get');
    assert.ok(isRecord(read.result) && isRecord(read.result.value));
    assert.equal(read.result.value.lesson, 'eigenvectors');

    // Startup recovery needs APS key listing, not just the indexed KV reads.
    const listing = await hostCall(base, sessionId, 'storage', 'list', {
      prefix: 'linear-algebra-tutor/smoke/', limit: 100,
    });
    assert.equal(listing.ok, true, 'Anna rejected the granted storage.list');
    assert.ok(isRecord(listing.result) && Array.isArray(listing.result.items));
    assert.ok(listing.result.items.some((item) => isRecord(item) && item.key === key),
      'Anna storage.list did not return the saved smoke-test key');

    const completion = await hostCall(base, sessionId, 'llm', 'complete', {
      systemPrompt: 'Guide the student using the Socratic method.',
      messages: [{ role: 'user', content: 'What is an eigenvector?' }],
      maxTokens: 256,
    });
    assert.equal(completion.ok, true, 'Anna rejected the granted mock LLM');
    assert.ok(isRecord(completion.result) && isRecord(completion.result.content));
    assert.match(stringField(completion.result.content, 'text'), /Av = λv/);

    const denied = await hostCall(base, sessionId, 'fs', 'read', { path: 'private.txt' });
    assert.equal(denied.ok, false, 'Undeclared file access must be denied');
  } finally {
    const deleted = await hostCall(base, sessionId, 'storage', 'delete', { key });
    assert.equal(deleted.ok, true, 'Unable to remove smoke-test storage');
  }

  process.stdout.write('Anna mock host smoke passed: bundle, materials, storage/list, LLM, ACL\n');
}

await main();
