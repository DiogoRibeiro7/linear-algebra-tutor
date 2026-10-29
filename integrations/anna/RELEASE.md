# Anna Marketplace release packet

This packet is for the standalone Anna edition of Linear Algebra AI Tutor.
It is a release candidate, not evidence of Anna approval or publication.
The original React/FastAPI/Claude edition remains a separate application.

## Marketplace listing

Use the version-controlled fields in [`app.json`](app.json):

| Field | Value |
| --- | --- |
| Name | Linear Algebra AI Tutor |
| Slug | `linear-algebra-ai-tutor` |
| Category | Education |
| Tagline | Learn linear algebra through guided, source-grounded questions |

Suggested long description, subject to Anna's current listing limits:

> Study linear algebra by working through questions with an interactive
> Socratic tutor. Choose a topic and hint level, write or edit a problem,
> and work through follow-up questions at your own pace. The tutor renders
> mathematical notation, shows relevant excerpts from its bundled course
> chapters, and saves your conversations in app-scoped Anna storage.
>
> Topics include vectors, matrices, linear systems, vector spaces, linear
> transformations, determinants, eigenvalues, and orthogonality with least
> squares. Course lookup supports selected English and Portuguese terms.
> Suggested starter and follow-up questions are editable and do not send
> a model request until you submit them.

Do not describe the retrieval as semantic search, promise mathematically
correct answers, or claim that the tutor replaces a human teacher. Its
course-material retrieval is deterministic, lexical BM25; the live model
must be evaluated separately for mathematical accuracy and pedagogy.

## Listing assets and real screenshots

- `listing/logo.svg`: original editable vector logo.
- `listing/logo.png`: 512 × 512 PNG for a listing upload.
- No screenshots are bundled yet. Capture them **from a running Anna build**
  with a test account after authorization, using synthetic questions only:
  1. A new conversation showing topic selection, a starter prompt, and hints.
  2. A two-turn mathematical exchange showing KaTeX and a course excerpt.
  3. A compact 400px view with the accessible saved-chat drawer.

Review the image for names, account details, tokens, and user-written material
before uploading. Do not fabricate a model answer or use a mock-host screenshot
as evidence of successful production integration.

## Student-facing disclosure to review

- The tutor is an educational assistant; model output can be incorrect.
  Verify mathematical steps and important academic work independently.
- Model requests use Anna's configured model and count against the user's
  applicable quota. Selecting a draft suggestion alone makes no model call.
- Conversations are persisted using the Anna app-scoped storage capability;
  the application requests model completion and key-value storage access.
- This edition does not require a user-supplied Anthropic API key or an
  external tutor backend. It does not collect payment details in the app.
- Confirm Anna's live data-handling terms and any commercial disclosures with
  the developer account before publishing. No specific price is promised here.

## Release gates

### Automated, offline: required on every release candidate

From `frontend/`, with Node.js 22+ and the repository's pinned Yarn version:

```bash
corepack yarn install --immutable
corepack yarn lint
corepack yarn tsc --noEmit
corepack yarn typecheck:tests
corepack yarn test
corepack yarn test:anna-materials
corepack yarn build:anna
corepack yarn validate:anna
corepack yarn preflight:anna
```

The preflight checks the metadata, manifest shape, 512px logo, source index,
static entrypoint and compiled assets, and basic accidental secret/evaluation
key exposure. It is a guard against packaging mistakes, **not** a penetration
test or a certification of Anna's runtime.

### Local mock: required for interaction regressions

Run the deterministic Anna mock host and `corepack yarn smoke:anna` using the
commands in [README.md](README.md). Also inspect keyboard navigation,
small-window layout, course citations, storage error handling, and recovery
after interrupted model requests. Mock-host storage does not prove real
account isolation or persistence.

### Authenticated Anna: blocked until owner authorization

- Activate the owner-controlled Anna developer account and agree to the
  applicable [Developer Terms](https://anna.partners/developers/reference/developer-terms).
- Run the actual app in a developer draft with **real** model and storage
  capabilities. These tests may consume model quota.
- Execute all 16 cases in [`evaluation/cases.json`](evaluation/cases.json)
  according to the [mathematical and Socratic evaluation protocol](README.md#mathematical-and-socratic-release-evaluation). Record
  mathematical correctness, Socratic hints, language, relevance of cited
  excerpts, and any unsafe or misleading behaviour. Curated expectations are
  evaluation references, not data to send to the student-facing bundle.
- Confirm APS persistence across restarts and isolation between two separate
  authorized test accounts. Test save, delete confirmation, retry, edit,
  permission rejection, and app reopening.
- Capture the real screenshots listed above, check the privacy and quota
  disclosures, and review the final permissions and Marketplace text.
- Ask the owner to approve the final submission and publish only after Anna
  review approval. Do **not** run authenticated CLI commands, publish, submit,
  or spend model quota as part of routine CI or these offline checks.

Anna's [App Review guidance](https://forum.anna.partners/t/app-review-timeline-process/318)
describes listing-content and security review, including screenshots, logo,
permissions, and core functionality. Acceptance and timing are controlled by
Anna; this repository does not assert that review has begun.
