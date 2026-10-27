import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFrontmatter, splitIntoChunks } from './build-materials.mjs';

test('frontmatter is read without consuming the lesson body', () => {
  const result = parseFrontmatter('---\ntopic: matrices\nchapter: 2\n---\n# Matrix inverse');
  assert.deepEqual(result.metadata, { topic: 'matrices', chapter: '2' });
  assert.equal(result.body, '# Matrix inverse');
});

test('long paragraphs are chunked within the limit', () => {
  const chunks = splitIntoChunks('a'.repeat(1500), 900);
  assert.equal(chunks.length, 2);
  assert.ok(chunks.every((chunk) => chunk.length <= 900));
  assert.equal(chunks.join(''), 'a'.repeat(1500));
});

test('empty documents do not create false passages', () => {
  assert.deepEqual(splitIntoChunks('  \n\n  '), []);
});
