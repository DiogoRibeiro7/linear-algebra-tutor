/**
 * Convert distributable course materials into an Anna bundle search index.
 * No student information, credentials, or runtime files are included.
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
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
 * Split by paragraphs without silently discarding long paragraphs.
 * @param {string} text
 * @param {number} limit
 * @returns {string[]}
 */
export function splitIntoChunks(text, limit = 900) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be positive');
  /** @type {string[]} */
  const chunks = [];
  let current = '';

  /** @param {string} part */
  const append = (part) => {
    if (!part) return;
    if (current && current.length + part.length + 2 > limit) {
      chunks.push(current);
      current = '';
    }
    if (part.length > limit) {
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

  for (const paragraph of text.split(/\n\s*\n/)) append(paragraph.trim());
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
      chunks.push({
        id: `${relative}#${index + 1}`,
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
