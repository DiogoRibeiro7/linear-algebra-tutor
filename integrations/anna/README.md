# Anna edition of Linear Algebra AI Tutor

This directory packages a separate Anna Marketplace edition of the tutor.
The existing React/FastAPI/Claude application remains unchanged and can
continue to run independently. The Anna edition shares the mathematical
message renderer, uses Anna's model API, and persists conversations in
Anna Persistent Storage (APS).

## What works

- React/TypeScript interface with KaTeX mathematical expressions.
- A compact-window layout that keeps the tutor full-width at Anna's 400px
  minimum view width, with a keyboard-accessible conversation drawer.
- A Socratic system prompt with minimal, standard, or generous hints.
- Bounded model context for long conversations: recent complete exchanges are
  prioritized without altering the conversation saved in Anna storage.
- Topic filtering, source attribution, and a deterministic BM25 retrieval
  index built from `data/materials/` (`.md`, `.txt`, and `.py`).
- Expandable, mathematically rendered previews of the exact passages supplied
  to the model, alongside each saved answer.
- Curated English/Portuguese linear-algebra terminology normalization,
  including accents, common plurals, and phrases such as *valores próprios*.
- Conservative source-relevance gating: generic requests about unrelated
  subjects do not receive course citations merely because they share verbs
  such as *calculate* or *solve* with lesson texts.
- Eight original course chapters covering vectors, matrices, systems,
  subspaces, linear transformations, determinants, eigenvalues, and
  orthogonality/least squares, including worked examples and practice prompts.
- Per-user conversations stored through Anna's app-scoped storage API.
- Recovery of unindexed conversations and stale deleted-chat entries after
  interrupted multi-step storage writes.
- Model calls billed against the Anna user's configured model and quota.
- Recovery of unanswered student questions after an interrupted model call,
  including after closing and reopening the tutoring window, with the option
  to revise a failed question without creating a second unanswered turn.

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
The source-relevance check removes generic instructional terms before BM25
ranking and requires a recognized linear-algebra concept (or a combination of
contextual concepts) before attaching passages. Short queries about known
concepts remain supported. Queries with no qualifying evidence still reach the
tutor model with an explicit "no relevant course excerpt" notice; they do not
receive fabricated course references. This is a conservative lexical safeguard,
not an out-of-domain classifier or proof that cited material is relevant.
Extend the curated concept vocabulary and its regression cases when the
course corpus gains subjects or terminology.

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
Each generated passage ID includes a short SHA-256 fingerprint of its text.
The tutor saves these IDs with an answer and resolves the passages from its
bundled index; it does not copy entire lesson texts into per-user storage.
If course material changes, an old reference remains visible by filename but
its outdated passage preview is marked unavailable, never silently replaced
with new mathematical text. Older saved conversations without passage IDs
continue to show their original filenames. The displayed passages are the
retrieval context given to the model, not proof that the model used every
passage in composing its reply.
`yarn test` regenerates the same index and includes an offline retrieval quality
suite. `yarn test:retrieval` runs that suite independently: eight English and
eight Portuguese questions, one per chapter in each language, must retrieve
the correct chapter within the first three excerpts. Ten additional bilingual
negative cases guard against attaching course sources to unrelated questions.
It reports recall@1, mean reciprocal rank at three, and the false-attribution
rate on those specific negative cases, without an Anna account or model calls.
These are regression metrics on curated questions, not estimates of real-world
student-question accuracy, domain classification, or answer correctness.
The indexer rejects a code or display-math block longer than its 900-character
chunk limit: split such blocks into smaller complete examples.

The `hostContract.test.ts` suite uses Anna's official `mountBundle` harness
to verify manifest permissions, storage calls, Socratic model requests, and
permission denials. These tests do not need the Python bridge.

The model receives up to five recent complete question/answer exchanges,
subject to a 6,000-character history budget. If the newest exchange exceeds
that budget, the tutor retains the beginning and end of each message with an
explicit omission marker; older exchanges are omitted whole. The latest
student question, current source excerpts, and stored transcript are not
shortened. This is a predictable character limit rather than a tokenizer-
accurate context guarantee for every model Anna may provide. Students can
still scroll through the complete saved conversation in the app.

At view widths below the `md` breakpoint, the conversation list is collapsed
behind an **Open conversations** button. It overlays the tutor rather than
reserving a fixed sidebar width. The drawer closes after opening a saved chat
or starting a new one, and can also be dismissed with Escape, its close
button, or the backdrop. At wider widths the sidebar remains visible.

If a model request fails after saving the student's question, the conversation
shows **Retry answer** and **Edit question** beside that unanswered turn. The
composer does not accept an unrelated new question until the pending turn is
resolved; otherwise the old question could be stranded in the conversation.
Retry sends the existing question to the model without duplicating the user
message. Editing loads that saved question into the composer and replaces the
same stored message only when the student submits the revision. Canceling an
edit preserves the original question. Both recovery actions work after
reopening the Anna window because the unanswered question is in app-scoped
storage. Each retry or resubmission may use another model call and consume
quota; the interface warns users before retrying.

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
  On startup, the tutor reconciles its index against all pages of APS keys
  under `linear-algebra-tutor/v1/conversations/`. This recovers a conversation
  that was saved before its index write failed, and removes a stale index
  entry after deletion by confirming that the conversation record is absent.
  The scan is limited to this app's own prefix and does not retrieve unrelated
  APS keys. Index writes use Anna's `if_match` ETag when available, with bounded
  retries on version conflicts; absent ETags cannot provide the same guarantee.
  These two writes are still not a transaction, and an interrupted update to
  the title of an already-indexed conversation may retain its old index title
  until a later successful write. Anna's storage access is expected to remain
  user-scoped; verify this in production with two distinct accounts.

The Anna integration is non-exclusive and does not replace the standalone
application's backend, database, authentication, or model configuration.
