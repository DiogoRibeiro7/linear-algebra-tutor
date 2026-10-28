import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMaterials, parseFrontmatter, splitIntoChunks } from './build-materials.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const requireFromFrontend = createRequire(path.join(repositoryRoot, 'frontend/package.json'));

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

test('fenced code and display math remain complete across blank lines', () => {
  const markdown = [
    'Intro', '', '```python', 'x = 1', '', 'y = 2', '```',
    '', '$$', 'x+y', '', '=3', '$$', '', 'Summary',
  ].join('\n');
  const chunks = splitIntoChunks(markdown, 46);
  const code = chunks.find((part) => part.includes('```python'));
  const math = chunks.find((part) => part.includes('$$'));

  assert.ok(code?.includes('x = 1\n\ny = 2\n```'));
  assert.ok(math?.includes('$$\nx+y\n\n=3\n$$'));
  assert.ok(chunks.every((part) => part.length <= 46));
});

test('oversized or unclosed protected blocks fail instead of producing broken notation', () => {
  assert.throws(() => splitIntoChunks(`\`\`\`python\n${'x'.repeat(60)}\n\`\`\``, 40),
    /exceeds 40 characters/);
  assert.throws(() => splitIntoChunks('$$\na+b', 40), /Unclosed Markdown math/);
});

test('empty documents do not create false passages', () => {
  assert.deepEqual(splitIntoChunks('  \n\n  '), []);
});

test('the distributable corpus covers the core curriculum with valid source metadata', async () => {
  const chunks = await buildMaterials();
  const required = new Map([
    ['1', 'vectors'],
    ['2', 'matrices'],
    ['3', 'linear systems'],
    ['4', 'subspaces and bases'],
    ['5', 'linear transformations'],
    ['6', 'determinants'],
    ['7', 'eigenvalues and eigenvectors'],
    ['8', 'orthogonality and least squares'],
  ]);

  assert.ok(chunks.length >= required.size, 'each chapter should contribute passages');
  assert.equal(new Set(chunks.map(({ id }) => id)).size, chunks.length, 'IDs are unique');
  assert.ok(chunks.every(({ content }) => content.length > 0 && content.length <= 900));
  assert.ok(chunks.every(({ content }) => !content.startsWith('---')),
    'frontmatter should not appear in retrieved passages');

  for (const [chapter, topic] of required) {
    assert.ok(chunks.some((chunk) => chunk.chapter === chapter && chunk.topic === topic),
      `missing indexed chapter ${chapter}: ${topic}`);
  }
});

test('every lesson equation is accepted by the KaTeX renderer used by the tutor', async () => {
  const katex = requireFromFrontend('katex');
  const chunks = await buildMaterials();
  const sources = [...new Set(chunks.map(({ source }) => source))];

  /** Check exactly the Markdown fragment that will be delivered to the model. */
  const checkMath = (markdown, label) => {
    const fences = markdown.match(/^```/gm) ?? [];
    assert.equal(fences.length % 2, 0, `${label}: incomplete code fence`);

    const text = markdown.replace(/```[\s\S]*?```/g, '');
    const expressionPattern = /\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g;
    const equations = [...text.matchAll(expressionPattern)];
    assert.ok(!text.replace(expressionPattern, '').includes('$'),
      `${label}: incomplete or malformed math delimiter`);

    for (const [, display, inline] of equations) {
      const expression = (display ?? inline).trim();
      assert.doesNotThrow(() => katex.renderToString(expression, { throwOnError: true }),
        `${label}: KaTeX could not parse ${expression}`);
    }
    return equations.length;
  };

  for (const source of sources) {
    const filename = path.join(repositoryRoot, 'data/materials', source);
    const raw = await readFile(filename, 'utf8');
    assert.ok(checkMath(raw, source) >= 3, `${source}: expected mathematical expressions`);

    for (const chunk of chunks.filter((item) => item.source === source)) {
      checkMath(chunk.content, chunk.id);
    }
  }
});
