# Workstation Agent implementation plan

Status: Stages 1–4 implemented; local validation completed 2026-10-13. Stage 5 (remote Etsy draft) remains out of scope.
Prepared: 2026-10-13. Intended implementation model: GPT-6 Luna, High reasoning, Standard speed.

## User intent and agreed scope

The user wants a CafeHTML-style conversation inside a new Workstation Agent tab. The agent knows the actual app state, uses the app's operations, completes an agreed listing pipeline, and revises the same work through conversation. Users discuss the listing's purpose, audience, artwork, garment, placement, mockups, and copy without leaving the conversation to request routine changes.

Initial improvement scope is designs, listings, presets, and workflow settings. The agent does not edit application source code, install packages, run shell commands, or give itself new tools. A later app-wide superuser is outside this release.

The user subsequently instructed implementation through Stages 1–4 in this chat. This document records that implementation and its validation; it does not authorize Stage 5.

## Product decisions

1. Add Agent under Product studio in the workspace sidebar. Do not remove the existing Assets, Design, Mockups, Products, PDF, Etsy, or Amazon views in this release.
2. First prove one physical T-shirt workflow: saved/uploaded artwork -> configured product -> mockups -> persisted product -> local Etsy physical worksheet draft with generated metadata. Then add optional design preparation/revision and lasting preset changes to the same runtime.
3. Completion of the initial pipeline means a saved local draft, not an Etsy upload or published listing. Offer a clearly separate remote-draft action once its integration is verified. Do not publish a live listing or trigger Printify fulfillment in this release. Amazon and digital listing automation are later vertical slices; their existing manual paths remain.
4. Once the user gives an executable brief, continue through its supported steps automatically. Missing source, ambiguous product selection, missing preset, or required business facts produce specific questions in chat. Do not repeatedly ask permission for already authorized work.
5. Changes apply to the current work by default. Saving a named preset or changing a default is a distinct explicit instruction; represent its affected fields in a reviewable card. Explicit instructions count as authorization without another redundant approval.
6. Start with the existing Gemini key and text model integration. Use a provider boundary; a second provider and model selector are not required to prove the workflow. The model used to implement this feature in Codex is independent of the model used inside the app.
7. Initial automation requires the local Next server and an open workstation browser. It survives navigation and refresh through saved state. It is not a scheduled, closed-browser, or serverless background worker. Show this limitation plainly near run status, rather than pretending tasks run while the app is closed.

## Repository facts verified during planning

| Capability | Existing implementation | Integration consequence |
| --- | --- | --- |
| Workspace navigation | `src/components/ClientLayout.tsx`, `Sidebar.tsx` | View unions and saved-view validation currently have no `agent` value. |
| Gemini | `src/lib/geminiApi.ts`, `clientApiKey.ts` | Default text model is `gemini-3.1-flash-lite`; the helper has no native tool-call request/response types yet. Reuse key resolution and error handling. |
| Imported assets | `/api/workspace/assets`, `src/lib/workspaceAssets.ts` | Existing imported media can be selected by stable IDs/URLs. Importing an arbitrary Etsy link still depends on its existing import mechanism; do not invent a scraper. |
| Design preparation | `BulkBackgroundRemover.tsx`, `/api/image/extract`, `/api/image/mask`, cutout/flat-design libraries | Some orchestration and pixel processing are browser-owned. Extract operations, not UI click automation. |
| Design ideas/remix | `/api/design/ideas`, `/api/image/remix`, `designIdeation.ts` | These include pre-existing uncommitted work. Read it before integration and preserve it. Remix produces new artwork; it is not a precise recolor or print-placement operation. |
| Saved designs | `src/lib/savedExtractedDesigns.ts` | IndexedDB, not a server-readable library. Bridge selected artifacts into persisted agent media. |
| Mockup templates | `src/lib/mockupPresetStorage.ts`, `vintageMockups.ts` | Custom presets use IndexedDB; built-in presets are code-defined. The runtime cannot access custom presets without a browser bridge. |
| Mockup rendering | exported `renderMockup()` in `MockupStudio.tsx` | Uses `window.Image` and `document.createElement('canvas')`. It cannot execute in a Node route. |
| Product orchestration | `WorkspaceProducts.tsx`: `freshProduct`, `persistProduct`, `generate`, `handoff` | Creation/rendering orchestration is embedded in React. Rendering saves each completed frame and supports recovery. Extract and reuse this behavior. |
| Product persistence | `workspaceProductStore.ts`, `/api/workspace/products` | Stable UUIDs, expected numeric revisions, immutable stored media, ready-state validation. Reuse it, including conflicts. |
| Listing handoff | `WorkspaceProducts.handoff`, `SpreadsheetGrid` inbox effect | Export alone does not create a worksheet row. Current handoff uses `workspace_listing_inbox` in localStorage and relies on a mounted grid. Agent execution must not rely on that mount. |
| Worksheet merge | `mergeProductIntoListing()` in `workspaceProducts.ts` | Refreshes assets of an existing product-linked row while retaining copy/remote IDs; new rows apply listing preset values. |
| Worksheet persistence | `workspaceListingStore.ts`, `/api/workspace/listings/[sheet]` | Stable `local_listing_id`, optimistic revision checks, atomic writes and migration backups. Never overwrite an entire sheet from stale chat context. |
| Metadata | `/api/generate`, `useAIPipeline.ts`, `listingWorkflow.ts` | Generate body is `{context,imagePaths,existingData,aiRules,forceRegenerate}`. Reuse title/acronym failsafes and field normalization. Existing hook is UI-bound and resolves on handled failure; do not treat its resolved promise as success. |
| Etsy push | `/api/etsy/push`, `useEtsyPush.ts` | Remote create/update, uploads, rollback and logging have side effects. UI hook can also coordinate Printify; Agent must not call that path indiscriminately. Audit exact draft behavior before exposing remote action. |

Pre-existing user work preserved: `src/app/api/image/remix/route.ts`, `src/components/BulkBackgroundRemover.tsx`, `src/app/api/design/`, `src/lib/designIdeation.ts`, and `tests/designIdeation.test.ts`. The working tree was rechecked before and after implementation; unrelated dirty files were retained.

CafeHTML reference: [runtime migration record](https://github.com/Fiverr929/moneytree/blob/main/docs/CLEAN_RUNTIME_MIGRATION.md), [interaction protocol](https://github.com/Fiverr929/moneytree/blob/main/src/lib/command-center/protocol.ts), and [isolated runtime](https://github.com/Fiverr929/moneytree/blob/main/harness/clean-runtime/runtime.ts).

Reuse its principles: one command gateway, durable progress/results, immutable action inputs, deterministic selection, and reconciliation after ambiguous provider dispatch. Do not copy its mock runtime as a production conversational agent or bring its unrelated platform into this repository.

## Architecture to implement

### Ownership

The server owns session state, command/action records, validated tool admission, permissions, and task completion. A model proposes tool calls; validated application code executes them. The browser hosts a narrow executor for canvas rendering and browser-owned libraries. Mount it once in `ClientLayout`, so opening another tab within the workstation does not kill an active run.

Do not implement the agent by generating arbitrary URLs, interpreting keywords as the entire planner, clicking hidden components, or granting arbitrary filesystem/network/shell access.

### Proposed files and responsibilities

These are proposed additions, not existing files. Keep modules small enough to test without React or a live provider.

| File | Responsibility |
| --- | --- |
| `src/lib/agent/contracts.ts` | Typed commands, interactions, brief, actions, tool schemas and result references. |
| `src/lib/agent/store.ts` | Atomic local session persistence, revisions, command deduplication and executor claims. |
| `src/lib/agent/runtime.ts` | Advance one bounded turn, resolve selected IDs, dispatch validated actions, project results. |
| `src/lib/agent/provider.ts` | Provider-neutral model input/output and Gemini adapter with native function calling. |
| `src/lib/agent/tools.ts` | Explicit tool registry, argument validation, execution location and authorization rules. |
| `src/lib/agent/context.ts` | Compact state summaries plus on-demand lookups, exact selected artifacts/presets and app capability description. |
| `src/lib/agent/browserExecutor.ts` | Claimed canvas/library actions and persisted acknowledgements. No independent planner. |
| `src/lib/workspaceProductOperations.ts` | Shared product construction and orchestrated product operations previously embedded in `WorkspaceProducts`. Keep browser dependencies separate from server imports. |
| `src/lib/mockupRenderer.ts` | Extract current browser rendering implementation without changing rendered output. |
| `src/lib/workspaceListingOperations.ts` | Shared row-by-ID preparation, metadata application and revision-aware persistence. |
| `src/lib/agent/mediaStore.ts` | Persist agent artwork with validated IDs, local URLs and image size/type limits. |
| `src/hooks/useWorkstationAgent.ts` | Session projection, command posting, status refresh, browser bridge and cancellation. |
| `src/components/WorkstationAgent.tsx` | Chat, structured questions, selection, brief, artifact preview and visible task state. |
| `src/app/api/agent/sessions/route.ts` | Create/list sessions with summaries. |
| `src/app/api/agent/sessions/[id]/route.ts` | Read saved session projection. |
| `src/app/api/agent/sessions/[id]/commands/route.ts` | Admit typed commands and advance a bounded runtime step. |
| `src/app/api/agent/sessions/[id]/actions/[actionId]/route.ts` | Claim/acknowledge browser actions against exact action/input version. |
| `src/app/api/agent/media/route.ts` | Persist uploaded/prepared artwork; use a dedicated delivery route outside public if needed. |

Adapt naming if an existing abstraction is a better fit. Do not create an empty placeholder module merely to satisfy this table. Agent routes use `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, validated bodies and no-store reads. Local mutation endpoints accept same-origin application requests; model-produced arguments cannot bypass their checks.

### State and contracts

Store local sessions under `.workspace-data/agent/` using `process.cwd()` and `path.join`; that root is already ignored. Media must be stored in an ignored location too, either below it with a controlled delivery route or an explicitly ignored `public/workspace-agent/` directory. No machine-specific paths in source.

A session contains: schema version, UUID, revision, timestamps, selected source/product/listing IDs, brief, authorization scope, interactions, command ledger, action ledger, and current artifact references. Initial local deployment supports one Next server process. Serialize mutations per session, use atomic file replacement and persisted claims; do not claim distributed worker safety. Distinct browser tabs must not simultaneously own the same action.

Brief fields: source IDs, audience/purpose, product type/color, front/back artwork, selected mockup preset snapshot, artwork placement, listing preset snapshot, copy direction and requested endpoint. Include only confirmed facts. Unknown pricing, materials, shipping or processing profiles remain unknown until resolved.

Commands: `message.send`, `selection.set`, `question.answer`, `proposal.apply`, `run.continue`, `run.cancel`, `action.retry`, `preset.save`, and later `etsy.draft.create`. Each has a caller-generated stable command ID. Explicit selections, answers, cancellations and retries use deterministic routing where possible; do not spend a model call to interpret a button.

Action fields: stable ID, command ID, tool name, immutable validated inputs/input signature, dependency IDs, expected entity revisions, execution location, status, attempt count, claim token/expiry, result IDs/URLs, error and timestamps. States: queued, running, waiting-for-user, waiting-for-browser, completed, failed, cancelled, reconciliation-required. Chat interactions are projected from the same durable session as task status; there is no second local authoritative transcript.

Once an action is admitted, persist it before executing. Complete it only after its result is saved. Replayed command IDs return existing results. Product IDs are allocated and saved before rendering; an interrupted render resumes missing frames only if the input signature is unchanged. Changed artwork/placement invalidates affected render results, readiness, export and review status; never show old images as a completed new version.

If a paid call or external create may have succeeded but its receipt is lost, mark reconciliation-required instead of automatic retry. Exactly-once execution of external providers cannot be guaranteed. A browser action with an expired claim must first inspect persisted results; stale acknowledgements cannot finish a newer action.

### Model loop and cost controls

Extend the Gemini request/response types with optional function declarations and `functionCall`/`functionResponse` parts while preserving all existing text/image callers. Use native tool calls, runtime argument validation, and real tool outcomes returned to the model. Do not make unconstrained model JSON executable.

Default limits per user turn: 8 model calls, 12 tool executions, one automatic corrective attempt per failing stage, and at most one automatic image regeneration. Stop with a resumable explanation at the limit. No automatic provider upgrade or silent switch to a costlier model. Surface quota/auth failures; do not retry them in a loop. Respect cancellation before each next dispatch; already completed results remain saved.

Use the existing stored or environment key. Do not persist keys, authorization headers, base64 images or full provider payloads in chat/events. Store artifact IDs/URLs and retrieve bounded image previews only when vision is needed. Rebuild context from the confirmed brief, recent messages, compact tool outcomes and current entity revisions. Persist any older-message summary; keep exact selected brief/settings outside the summary. Usage reporting uses returned token usage where available; never invent dollar totals.

## Initial tool set

| Tool | Owner and result |
| --- | --- |
| `workspace.inspect` | Server: available products/imported assets, connection availability and supported capabilities; no credentials. |
| `artifact.select` / `artifact.inspect` | Resolve exact IDs; persist uploaded/browser-only artwork first; image inspection uses the real selected image. |
| `presets.list` | Browser bridge: validate existing IndexedDB/localStorage and built-in presets; return summaries and selected immutable snapshots. Avoid sending all preset pixels to the model. |
| `product.create` / `product.configure` | Shared operations and product store: validated fields and placement ranges, UUID/revision, explicit front/back roles. |
| `mockups.render` | Browser executor: reuse renderer, persist each frame, return persisted product revision and image URLs. |
| `listing.prepare` | Server: export ready product, merge one linked row with listing preset, allocate stable local ID, persist expected sheet revision. |
| `listing.generate` / `listing.revise` | Shared metadata operation: call existing generation logic and patch only requested fields on the targeted current row. |
| `listing.validate` | Deterministic checks: required fields, title/acronyms, image/file counts, tags and selected taxonomy values. Product facts come from confirmed data. |
| `design.prepare` / `design.revise` | Later stage of this release: reuse extract/flat/cutout/ideas/remix operations with explicit distinctions. Persist chosen output before the next step. |
| `preset.save` / `workflow.configure` | Browser bridge initially: named, validated settings using existing stores; show diff and retain prior snapshot for undo. Clone built-ins rather than modifying code constants. |
| `etsy.draft.create` | Optional final stage after audit: explicit remote intent, snapshot-specific authorization, actual remote ID/state confirmation and recovery. No live publish or implicit POD. |

No generic `fetch`, arbitrary path, shell, source editing, deletion or publish tool. Adding any future tool requires a server-side contract and tests; the conversational agent cannot register one itself.

## UI behavior

Desktop: conversation and a result panel; workflow progress is a compact expandable part of the result panel. Mobile: conversation/result switcher. Keep the existing zinc/blue visual language and accessible controls.

Empty state offers Select artwork, Open saved product, and Describe listing. Show a compact brief card once work is selected: audience, product/color, placement, selected presets and target endpoint. Questions and choices occur in chat. The user can edit the brief without visiting Settings.

Results show actual stored artwork/mockup URLs, current product/listing revision, copy and validation findings. Selecting a concept stores its exact ID/prompt/settings, so “use option two” and “generate it” do not reconstruct it from prose. Preview has links to the existing product or worksheet. Opening the manual editor keeps the session; subsequent agent actions reread current state and detect conflicts.

Progress distinguishes local draft ready, remote draft created, failure, interruption and awaiting input. Use an explicit Stop control; stop scheduling new steps, and do not promise rollback of work already done. Provide Retry only for known safe failures, Resume for paused browser work and Reconcile for ambiguous external outcomes. Never render a success message without a saved successful result.

## Implementation stages and gates

### Stage 1 — Durable runtime foundation

Implement contracts, atomic store, command deduplication, claims, state projection, tool validation, model adapter and mocked runtime tests. No UI or marketplace side effects required yet. Fake provider/executor dependencies are injected for tests, not exposed as the production mode.

Gate: duplicate commands do not dispatch twice; two browser claims do not both win; cancellation stops the next step; refresh reloads the same projection; ambiguous provider outcomes block retry; invalid tool arguments never execute; keys/pixels stay out of saved events.

### Stage 2 — Shared operations and preset bridge

Extract browser mockup renderer and product create/render operations with unchanged output. Use those operations from both manual UI and Agent. Extract metadata normalization/application from `useAIPipeline` into a tested pure helper; retain route title/acronym handling. Refactor only the necessary functions, not the entire grid or product component.

Build direct server worksheet preparation with `mergeProductIntoListing`, stable local IDs and optimistic revisions. Extract a shared metadata service from `/api/generate` if needed rather than importing a route handler or inventing a model-controlled internal URL. Default to preserving manual copy; regenerate only fields explicitly requested by the action.

The Agent does not enqueue `workspace_listing_inbox` and wait for the grid to mount. Export and worksheet insertion each have persisted receipts. The manual inbox path may remain until deliberately migrated; it must not auto-generate the Agent row again.

Gate: manual products still render and save; Agent produces one product-linked row without mounting the worksheet; re-preparation preserves row ID/copy/remote ID; stale product/sheet revisions cause conflicts, not overwrites.

### Stage 3 — Agent tab and first complete vertical slice

Update `ClientLayout`/`Sidebar` view types and restoration checks. Mount the browser executor above individual workspace views. Add persisted sessions, artifact/preset selection, brief, tool-result cards, chat input, progress and stop/resume. Use status polling while active as the initial transport; SSE is optional, not required.

Make a real conversational model drive the validated tools. Test a selected artwork -> configure product -> render -> save -> prepare local Etsy draft -> generate/validate copy workflow. Show actual artifacts at each step. Fix mounted-grid stale-state handling: reload clean sheets on focus/workspace-change event and preserve existing conflict handling for unsaved sheets. Never reset revisions to bypass a conflict.

Gate: the user finishes the workflow through chat; changing tabs does not start a second executor; refresh resumes safely; a missing preset produces a useful selection question; quota/provider failure is visible and leaves saved work intact.

### Stage 4 — Feedback, design operations and lasting preferences

Support “smaller print”, “use pocket placement”, “change the description tone”, and selected-field regeneration on the same product/listing. Placement edits are deterministic configuration/render operations, not image remix calls. Text-only edits do not rerender or regenerate artwork. Re-export and refresh the linked listing only for changed media, preserving copy unless asked to revise it.

Extract selected design operations from `BulkBackgroundRemover` into reusable browser orchestration with phase progress and existing quality checks. Integrate the pending design-ideas work rather than replacing it. Image corrections use actual previews and bounded retries; deterministic checks must not be presented as a visual quality assessment. Persist prepared outputs and selected concept provenance.

Add explicit named preset/default saving with diff/undo through existing storage APIs. At minimum support mockup presets and physical listing presets; add image settings through the existing image preset format. Workflow settings are limited to named agent defaults (auto-continue to local draft and retry limits), not arbitrary localStorage keys.

Gate: current-work edits leave shared presets alone; explicit saves survive refresh and are visible in manual tools; undo restores the prior preset; design feedback uses the correct operation; stale revisions are surfaced; no unbounded generation/review loop.

### Stage 5 — Optional Etsy remote draft action

Before exposing it, audit `/api/etsy/push` payload/state handling, retry behavior, rollback, current listing updates and fulfillment coupling. Narrow the action to a new draft with explicit intent; do not silently update an existing remote listing. Validate necessary shipping/processing/production partner data. Do not inherit UI status wording that claims Published when only a draft was created.

Bind the authorization to exact product/listing revision and store the remote ID as soon as available. Resolve ambiguous outcomes without a duplicate create; log Etsy errors to the existing ignored `latest_error.json`. A controlled real push is performed only when the user authorizes that remote action. Initial acceptance can prove the local workflow without it, but must state that distinction.

## Real-data acceptance example

An existing saved product was verified during planning:

- ID: `0a3ae12c-1743-4766-9ded-d4efc8bdd124`.
- Name: `01-Front`.
- Planning-time revision: 5; render state: ready; two generated views; preset: Pepper T-Shirt.

Re-read it at implementation time; do not assume the revision or its availability. Open it read-only to inspect actual artwork, then make an explicit test copy for edits. Do not overwrite the original or any existing remote listing. This plan did not visually inspect its design or establish that it already has an Etsy worksheet row.

Acceptance conversation:

1. “Use this saved artwork to prepare a physical shirt listing. Keep its Pepper template and use my selected physical listing preset.” Confirm/select missing audience and business facts; do not invent what the artwork depicts.
2. Agent saves a test product, renders actual views, prepares one linked local draft and generates copy based on actual images and the confirmed brief.
3. “Make the print smaller and the description less salesy.” Keep the same test product and row IDs. Update placement, rerender affected frames, export revised media and regenerate only description.
4. Refresh during rendering. Previously saved frames stay visible; resume only remaining work for unchanged inputs.
5. Submit the same command ID again. It returns the saved outcome without an extra product, worksheet row or paid call.
6. “Save this placement as a new preset.” Show/save a named clone. A future session can choose it; the original preset is retained.
7. Local completion is reported as “Etsy draft ready in your worksheet.” A remote draft is a separate, authorized acceptance step if Stage 5 is included.

## Validation requirements

Use existing `node:test` conventions and temporary directories. Add meaningful tests under `tests/agentRuntime.test.ts`, `tests/agentStore.test.ts`, and `tests/agentListingWorkflow.test.ts` (combine when practical). Keep browser canvas checks in the browser; Node mocks cannot prove pixel fidelity.

Cover: duplicate admission, claim/recovery, stale completion rejection, cancellation, bounded loops, provider/key failures, unauthorized tool calls, result persistence, field-limited metadata updates, changed-input invalidation, row deduplication, preset scope/undo, sheet conflicts, and ambiguous remote dispatch. Run existing product/listing/artwork/design tests for affected shared operations.

Commands available in this repository: `npm test`, `npx tsc --noEmit`, targeted `npx eslint` for changed source, and `npm run build`. Run required checks once implementation is ready; record pre-existing failures separately. Browser-check both manual and Agent workflows at the existing dev port 3001, including narrower layout, navigation and refresh. Paid calls are not required for mocked tests; label real-provider/remote smoke results honestly.

Honor AGENTS.md: no loose scratch files, paths built from cwd, ignored `latest_error.json`, required dynamic routes, 500 ms worksheet localStorage debounce, custom dropdown option registry, current refs for async callbacks, title length/acronym failsafes, max 5 digital files and max 10 images. Do not remove the debounce or bypass revision handling to make Agent updates appear immediate.

## Implementation and validation record

Stages 1–4 are implemented: durable sessions and deduplicated commands; bounded, validated Gemini tool calls; browser-claimed work with stale-result and ambiguous paid-action protection; shared mockup/product/listing operations; a persistent Agent tab and browser executor; local media and saved presets; deterministic placement, design preparation/revision and local Etsy worksheet tools; and stop/resume, progress, preset selection/save/undo, and scoped workflow preferences. Stage 5 is not implemented.

Validation on 2026-10-13: `npm test` (71 passed), `npx tsc --noEmit`, targeted ESLint (0 errors or warnings), and `npm run build` passed. A read-only browser check confirmed the existing `01-Front` manual product view, Agent navigation, narrow-width Agent layout with the sidebar collapsed, and Agent view restoration after refresh. No live Gemini generation, paid image request, Etsy API call, or write to the existing product was performed. The full real-data acceptance conversation, preset undo in the browser, active-render refresh recovery, and narrow viewport with the sidebar expanded remain unverified. Runtime feedback fixes remove duplicate assistant final text after a tool call, and the Agent now checks for an exact imported Etsy listing ID before explaining the existing Flat Earth import flow.
