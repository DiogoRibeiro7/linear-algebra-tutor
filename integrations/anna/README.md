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
- Curated English/Portuguese linear-algebra terminology normalization,
  including accents, common plurals, and phrases such as *valores próprios*.
- Eight original course chapters covering vectors, matrices, systems,
  subspaces, linear transformations, determinants, eigenvalues, and
  orthogonality/least squares, including worked examples and practice prompts.
- Per-user conversations stored through Anna's app-scoped storage API.
- Model calls billed against the Anna user's configured model and quota.
- Recovery of unanswered student questions after an interrupted model call,
  including after closing and reopening the tutoring window.

The retrieval method is deliberately labeled **BM25 lexical retrieval**, not
the original MiniLM semantic retrieval. The standalone application's
`sentence-transformers/all-MiniLM-L6-v2` embeddings cannot be queried with
arbitrary embeddings from a different model. Before migrating semantic RAG,
confirm Anna's `llm.embed` input/output contract and model identity, or
introduce an authenticated external retrieval service. Do not silently mix
embedding spaces.

The bilingual glossary normalizes equivalent mathematical terms on both the
question and course-excerpt sides of BM25. It is not a translator and does not
make the search semantic. Unknown terminology still requires literal overlap;
we do not issue model calls or external requests during retrieval.

## Local build and validation

Prerequisites: Node.js 22+, Corepack, Yarn 4, and `uv` for the optional
Python-based dev server. The versioned Anna CLI is installed with the
frontend's dev dependencies. No Anna account or credentials are needed
for static builds, host-contract tests, or mock development.

```bash
cd frontend
corepack yarn install --immutable
corepack yarn test
corepack yarn test:retrieval
corepack yarn test:anna-materials
corepack yarn build:anna
corepack yarn validate:anna
```

Run the official Anna local host with deterministic tutoring responses:

```bash
# Terminal 1, in frontend/
corepack yarn anna-app dev --cwd ../integrations/anna \
  --manifest manifest.json --bundle bundle \
  --slug linear-algebra-ai-tutor \
  --mock-llm ../integrations/anna/fixtures/socratic-replies.jsonl \
  --no-watch
```

Then run an HTTP smoke test against the local dashboard in another terminal:

```bash
# Terminal 2, in frontend/
corepack yarn smoke:anna
```

The mock host serves its dashboard at `http://127.0.0.1:5180/`. The smoke
test creates a disposable session and checks the React entrypoint, course
index, storage round-trip, mocked LLM answer, and denial of an undeclared
file capability. It deletes its test record afterward. The mock fixture path
above is relative to the `frontend/` process directory, as required by the
pinned CLI version; `--cwd` controls the manifest and bundle paths instead.

`yarn build:anna` regenerates the course index, typechecks the frontend, and
creates `integrations/anna/bundle/` with `index.html`, JavaScript, CSS,
fonts, and `course-materials.json`. Generated files are ignored by Git.
Only add course content that you have permission to distribute publicly.
`yarn test:anna-materials` verifies chapter metadata, complete Markdown
code/math blocks, and all LaTeX expressions against the app's KaTeX renderer.
`yarn test` regenerates the same index and includes an offline retrieval quality
suite. `yarn test:retrieval` runs that suite independently: eight English and
eight Portuguese questions, one per chapter in each language, must retrieve
the correct chapter within the first three excerpts. It also reports recall@1
and mean reciprocal rank at three, without an Anna account or model calls.
These are regression metrics on 16 curated questions, not an estimate of
real-world student-question accuracy or mathematical answer correctness.
The indexer rejects a code or display-math block longer than its 900-character
chunk limit: split such blocks into smaller complete examples.

The `hostContract.test.ts` suite uses Anna's official `mountBundle` harness
to verify manifest permissions, storage calls, Socratic model requests, and
permission denials. These tests do not need the Python bridge.

If a model request fails after saving the student's question, the conversation
shows **Retry answer** beside that unanswered turn. The retry sends the existing
question to the model without adding a duplicate user message. It also works
after reopening the Anna window because the unanswered question is already in
app-scoped storage. Each retry may use another model call and consume quota;
the interface states this before the user clicks it.

For real model calls, activate developer access and follow Anna's
[`anna-app login` instructions](https://anna.partners/developers/apps/local-dev-llm),
then restart the dev server without `--mock-llm`. Real service calls consume
quota. The local mock uses in-memory storage: it does not prove production
authentication, persistent APS behaviour, cross-account isolation, or
mathematical quality of live model responses.

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
- The course corpus is a starting curriculum, not a substitute for academic
  review, localization, or assessment-specific teaching materials.
- Never upload real student records, credentials, private course documents,
  or institutional personal data into the static bundle.
- The index stores conversation metadata separately from each conversation.
  Anna's storage access is expected to remain user-scoped; verify this in
  production with two distinct accounts.

The Anna integration is non-exclusive and does not replace the standalone
application's backend, database, authentication, or model configuration.
