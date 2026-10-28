/**
 * Convert distributable course materials into an Anna bundle search index.
 * No student information, credentials, or runtime files are included.
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../../..');
const materialsRoot = path.join(repositoryRoot, 'data/materials');
const outputPath = path.join(repositoryRoot, 'frontend/anna/public/course-materials.json');
const allowedExtensions = new Set(['.md', '.txt', '.py']);

/** @param {string} text @returns {{ metadata: Record<string, string>, body: string }} */
export function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return { metadata: {}, body: text };
  const end = text.indexOf('\n---\n', 4);
  if (end < 0) return { metadata: {}, body: text };

  /** @type {Record<string, string>} */
  const metadata = {};
  for (const line of text.slice(4, end).split('\n')) {
    const colon = line.indexOf(':');
    if (colon > 0) {
      const key = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim();
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) metadata[key] = value;
    }
  }
  return { metadata, body: text.slice(end + 5) };
}

/**
 * Keep Markdown code fences and display equations intact, including blank
 * lines inside those blocks. Ordinary paragraphs can still be split.
 * @param {string} text
 * @returns {Array<{text: string, protectedBlock: boolean}>}
 */
function markdownBlocks(text) {
  /** @type {Array<{text: string, protectedBlock: boolean}>} */
  const blocks = [];
  /** @type {string[]} */
  let lines = [];
  /** @type {'paragraph' | 'code' | 'math'} */
  let kind = 'paragraph';

  const flush = () => {
    const value = lines.join('\n').trim();
    if (value) blocks.push({ text: value, protectedBlock: kind !== 'paragraph' });
    lines = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (kind === 'code') {
      lines.push(line);
      if (trimmed.startsWith('```')) {
        flush();
        kind = 'paragraph';
      }
      continue;
    }
    if (kind === 'math') {
      lines.push(line);
      if ((line.match(/\$\$/g) ?? []).length % 2 === 1) {
        flush();
        kind = 'paragraph';
      }
      continue;
    }
    if (trimmed.startsWith('```')) {
      flush();
      kind = 'code';
      lines.push(line);
      continue;
    }
    if (trimmed.startsWith('$$')) {
      flush();
      kind = 'math';
      lines.push(line);
      if ((line.match(/\$\$/g) ?? []).length % 2 === 0) {
        flush();
        kind = 'paragraph';
      }
      continue;
    }
    if (!trimmed) {
      flush();
    } else {
      lines.push(line);
    }
  }
  if (kind !== 'paragraph') throw new Error(`Unclosed Markdown ${kind} block`);
  flush();
  return blocks;
}

/**
 * Split paragraphs without corrupting fenced code or display equations.
 * @param {string} text
 * @param {number} limit
 * @returns {string[]}
 */
export function splitIntoChunks(text, limit = 900) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be positive');
  /** @type {string[]} */
  const chunks = [];
  let current = '';

  /** @param {string} part @param {boolean} protectedBlock */
  const append = (part, protectedBlock) => {
    if (!part) return;
    if (current && current.length + part.length + 2 > limit) {
      chunks.push(current);
      current = '';
    }
    if (part.length > limit) {
      if (protectedBlock) {
        throw new RangeError(`Markdown code/math block exceeds ${limit} characters`);
      }
      if (current) chunks.push(current);
      current = '';
      for (let index = 0; index < part.length; index += limit) {
        const slice = part.slice(index, index + limit).trim();
        if (slice) chunks.push(slice);
      }
      return;
    }
    current = current ? `${current}\n\n${part}` : part;
  };

  for (const block of markdownBlocks(text)) append(block.text, block.protectedBlock);
  if (current) chunks.push(current);
  return chunks;
}

/** @param {string} directory @returns {Promise<string[]>} */
async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  /** @type {string[]} */
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    else if (entry.isFile() && allowedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

/** Build an index that is identical for identical source materials. */
export async function buildMaterials() {
  const files = await collectFiles(materialsRoot);
  if (files.length === 0) throw new Error('No distributable course materials found');

  /** @type {Array<{id:string,source:string,type:string,topic:string,chapter:string|null,content:string}>} */
  const chunks = [];
  for (const filename of files) {
    const relative = path.relative(materialsRoot, filename).replaceAll(path.sep, '/');
    const raw = await readFile(filename, 'utf8');
    const { metadata, body } = parseFrontmatter(raw);
    const topic = metadata.topic || path.basename(filename, path.extname(filename))
      .replace(/^chapter\d+[_-]?/i, '').replaceAll(/[_-]/g, ' ');

    for (const [index, content] of splitIntoChunks(body).entries()) {
      // Version the passage ID by its exact text: saved evidence must never
      // resolve silently to different mathematics after a course update.
      const fingerprint = createHash('sha256').update(content, 'utf8')
        .digest('hex').slice(0, 16);
      chunks.push({
        id: `${relative}#${index + 1}@${fingerprint}`,
        source: relative,
        type: path.extname(filename) === '.py' ? 'code_example' : 'course_material',
        topic,
        chapter: metadata.chapter || null,
        content,
      });
    }
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(chunks, null, 2)}\n`, 'utf8');
  process.stdout.write(`Anna course index: ${chunks.length} chunks from ${files.length} files\n`);
  return chunks;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildMaterials();
}
