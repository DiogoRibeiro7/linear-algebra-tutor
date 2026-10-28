# Anna edition of Linear Algebra AI Tutor

This directory packages a separate Anna Marketplace edition of the tutor.
The existing React/FastAPI/Claude application remains unchanged and can
continue to run independently. The Anna edition shares the mathematical
message renderer, uses Anna's model API, and persists conversations in
Anna Persistent Storage (APS).

## What works

- React/TypeScript interface with KaTeX mathematical expressions.
- A Socratic system prompt with minimal, standard, or generous hints.
- Topic filtering, source attribution, and a deterministic BM25 retrieval
  index built from `data/materials/` (`.md`, `.txt`, and `.py`).
- Per-user conversations stored through Anna's app-scoped storage API.
- Model calls billed against the Anna user's configured model and quota.

The retrieval method is deliberately labeled **BM25 lexical retrieval**, not
the original MiniLM semantic retrieval. The standalone application's
`sentence-transformers/all-MiniLM-L6-v2` embeddings cannot be queried with
arbitrary embeddings from a different model. Before migrating semantic RAG,
confirm Anna's `llm.embed` input/output contract and model identity, or
introduce an authenticated external retrieval service. Do not silently mix
embedding spaces.

## Local build and validation

Prerequisites: Node.js 22+, Corepack, Yarn 4, and (for Anna's harness) `uv`
and the `@anna-ai/cli` package. No Anna credentials are needed for the
static build and deterministic tests.

```bash
cd frontend
corepack yarn install --immutable
corepack yarn test
corepack yarn test:anna-materials
corepack yarn build:anna

cd ../integrations/anna
anna-app validate --strict
anna-app dev --llm mock
```

`yarn build:anna` regenerates the course index, typechecks the frontend, and
creates `integrations/anna/bundle/` with `index.html`, JavaScript, CSS,
fonts, and `course-materials.json`. Generated files are ignored by Git.
Only add course content that you have permission to distribute publicly.

For real model calls, activate developer access and follow Anna's
[`anna-app login` and `--llm real` instructions](https://anna.partners/developers/apps/local-dev-llm).
The local mock run verifies interface wiring; it is not proof of successful
authentication, storage, or model execution on Anna's production host.

## Anna publishing (manual)

1. Read the [Developer Terms](https://anna.partners/developers/reference/developer-terms)
   and confirm IP ownership, student-data handling, and commercial conditions.
2. Activate an Anna developer profile using your own account.
3. Validate the version with `anna-app validate --strict`, then test the
   completed tutor inside a real Anna working draft.
4. Provide listing assets and submit for Anna App Review.
5. Publish only after approval and an end-to-end production verification.

See the [Anna App Manifest](https://anna.partners/developers/apps/app-manifest)
and [App UI Host API](https://anna.partners/developers/apps/app-ui-host-api).

## Operational constraints

- This is a schema-3 bundle-only Anna app. It does not require a Python
  Executa or a separate Anthropic API key.
- Users must grant the declared model and storage capabilities.
- Models may differ from Claude. Regression-test mathematical accuracy,
  source attribution, and Socratic hints before a public release.
- The current repository contains only the vectors example chapter. Expand
  the course corpus, with appropriate licensing, before recruiting students.
- Never upload real student records, credentials, private course documents,
  or institutional personal data into the static bundle.
- The index stores conversation metadata separately from each conversation.
  Anna's storage access is expected to remain user-scoped; verify this in
  production with two distinct accounts.

The Anna integration is non-exclusive and does not replace the standalone
application's backend, database, authentication, or model configuration.
