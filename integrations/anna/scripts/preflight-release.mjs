/** Basic offline packaging guard for the Anna Marketplace release candidate.
 *
 * Run after build:anna and validate:anna. This is not a security review, a
 * live Anna test, or a substitute for checking the mathematical model output.
 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(fileURLToPath(new URL('../', import.meta.url)));
const bundleDir = resolve(appDir, 'bundle');
const prohibitedFileName = /(^|\/)(?:\.env(?:\..*)?|.*\.(?:pem|key|map)|.*(?:secret|credential).*)$/i;
const possibleSecret = /(?:sk-ant-[a-zA-Z0-9_-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;

/** @param {unknown} value @param {string} name @returns {Record<string, unknown>} */
function object(value, name) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value),
    `${name} must be an object`);
  return /** @type {Record<string, unknown>} */ (value);
}

/** @param {Record<string, unknown>} value @param {string} key @returns {string} */
function nonEmptyText(value, key) {
  const field = value[key];
  assert(typeof field === 'string' && field.trim().length > 0,
    `${key} must contain text`);
  return field.trim();
}

/** @param {string} filePath @returns {Promise<unknown>} */
async function json(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

/** @param {string} directory @returns {Promise<string[]>} */
async function filesIn(directory) {
  /** @type {string[]} */
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    assert(!entry.isSymbolicLink(), `Symlink is not allowed in Anna bundle: ${path}`);
    if (entry.isDirectory()) result.push(...await filesIn(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

async function main() {
  const listing = object(await json(resolve(appDir, 'app.json')), 'Listing');
  const manifest = object(await json(resolve(appDir, 'manifest.json')), 'Manifest');
  nonEmptyText(listing, 'name');
  nonEmptyText(listing, 'tagline');
  nonEmptyText(listing, 'description');
  assert.equal(listing.category, 'education', 'Unexpected Marketplace category');
  assert.equal(listing.slug, 'linear-algebra-ai-tutor', 'Unexpected App slug');
  assert.equal(manifest.schema, 3, 'Expected a schema-3 Anna manifest');

  const ui = object(manifest.ui, 'Anna UI');
  assert(Array.isArray(ui.views) && ui.views.some((view) =>
    object(view, 'Anna view').name === 'main'), 'Missing main tutoring window');
  const requiredExecutas = manifest.required_executas;
  assert(Array.isArray(requiredExecutas) && requiredExecutas.length === 0,
    'This edition should not package an Executa');

  // A PNG copy is included for listing UIs that do not accept SVG uploads.
  const png = await readFile(resolve(appDir, 'listing/logo.png'));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a',
    'Marketplace logo must be a PNG');
  assert.equal(png.readUInt32BE(16), 512, 'Marketplace logo must be 512px wide');
  assert.equal(png.readUInt32BE(20), 512, 'Marketplace logo must be 512px tall');

  const courseIndex = await json(resolve(bundleDir, 'course-materials.json'));
  assert(Array.isArray(courseIndex) && courseIndex.length >= 8,
    'Anna bundle is missing distributable course passages');
  assert(courseIndex.every((chunk) => {
    const entry = object(chunk, 'Course passage');
    return typeof entry.id === 'string' && typeof entry.source === 'string'
      && typeof entry.content === 'string' && typeof entry.topic === 'string';
  }), 'Invalid bundled course passage');

  const bundleFiles = await filesIn(bundleDir);
  const relativeNames = bundleFiles.map((path) => relative(bundleDir, path).replaceAll('\\', '/'));
  assert(relativeNames.includes('index.html'), 'Anna UI entrypoint is missing');
  assert(relativeNames.some((name) => /^assets\/.*\.js$/.test(name)),
    'Anna UI JavaScript bundle is missing');
  assert(relativeNames.some((name) => /^assets\/.*\.css$/.test(name)),
    'Anna UI stylesheet bundle is missing');

  for (let index = 0; index < bundleFiles.length; index += 1) {
    const filename = relativeNames[index];
    assert(!prohibitedFileName.test(filename), `Potentially sensitive file in bundle: ${filename}`);
    if (/\.(?:html|js|css|json)$/.test(filename)) {
      const contents = await readFile(bundleFiles[index], 'utf8');
      assert(!possibleSecret.test(contents), `Potential credential in bundle: ${filename}`);
      assert(!contents.includes('"referenceCheck"') && !contents.includes('"socraticGoal"'),
        `Human evaluation answer keys must not ship in the bundle: ${filename}`);
    }
  }

  process.stdout.write(`Anna release preflight passed: ${courseIndex.length} passages, ${bundleFiles.length} bundle files, 512px logo\n`);
}

main().catch((error) => {
  process.stderr.write(`Anna release preflight failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
