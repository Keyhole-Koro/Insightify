# discussion.agent.md

This file captures discussion notes and decisions made with the user.
Agents should reference it when proposing architecture and implementation strategy.

## Note Template

```md
## YYYY-MM-DD HH:mm:ss UTC
- User Intent:
- Agreed Direction:
- Avoid:
- Trade-offs:
- Open Questions:
- Next Actions:
```

## 2026-02-10 08:21:01 UTC
- User Intent:
  - Remove `gateway start submit` and move to `need user input` based continuation.
  - Prefer `worker` naming over `pipeline` naming.
  - Establish explicit agent operation rules.
- Agreed Direction:
  - Continue interaction within the same run while waiting for user input.
  - Prefer `need user input` naming in frontend-facing APIs.
  - Maintain dedicated files for change history and discussion memory.
- Avoid:
  - Using `resolve` / `normalize` without clear intent comments.
- Trade-offs:
  - When codegen tools are unavailable, perform compatibility-preserving staged migration.
- Open Questions:
  - Final timing for renaming proto field `pipeline_id` to `worker_key`.
- Next Actions:
  - Keep appending future updates to `change.agent.md`.

## 2026-02-11 07:34:15 UTC
- User intent: Keep frontend bootstrap entry simple and move orchestration details out of `useBootstrap`.
- Preferred architecture: Separate concerns for session init, stream/runtime orchestration, node mapping, and input-send transitions.
- Trade-off chosen: Keep current runtime behavior but move logic into dedicated hooks so future Core-driven UI migration can replace pieces incrementally.

## 2026-02-11 08:46:34 UTC
- User intent: Session handling, node synchronization, and run/send/stream orchestration should be generic infrastructure rather than bootstrap-bound logic.
- Direction applied: Introduced reusable hooks (`useRunSession`, `useRpcChatNodeSync`, `useChatRunController`) and reduced bootstrap hook to composition/orchestration.

## 2026-02-11 08:50:26 UTC
- User intent: Generic session/node-sync/run-stream hooks should not live under `pages/home`.
- Applied change: relocated reusable hooks to `src/hooks/chat` and kept `useBootstrap` as a page-level composition hook.

## 2026-02-11 08:57:58 UTC
- User issue: On frontend reload, LLM chat node is not displayed.
- Requested action: Add extensive logs to identify where node creation pipeline breaks.
- Implemented focus: trace session reinit, StartRun, WatchChat event flow, RPC node upsert create/update/skip, send flow, and Home node-array updates.

## 2026-02-11 08:59:59 UTC
- Observed issue: Reload flow started bootstrap run, but `WatchChat` events were treated as `EVENT_TYPE_UNSPECIFIED`; no RPC node upsert occurred, leaving node count at 0.
- Applied fix: Robust enum normalization in frontend client + fallback creation of LLM chat node shell when stream starts.

## 2026-02-11 09:02:35 UTC
- Observed issue: "bootstrap worker is not registered" despite bootstrap existing in current registry.
- Root cause: Existing sessions can keep stale in-memory RunCtx/Resolver that predates worker-key changes.
- Applied fix: `ensureSessionRunContext()` now recreates RunCtx when required workers are missing.

## 2026-02-11 09:07:39 UTC
- User issue: Sent messages disappeared from LLM node history, and `Reconnect failed: Stream interrupted` appeared immediately after send.
- Applied fix:
  - Treat `NEED_INPUT` as a normal watch pause point (return without error).
  - Merge RPC chat messages into existing local messages to keep user-entered history.

## 2026-02-11 09:11:44 UTC
- User issue: After send, history remained but assistant reply did not arrive.
- Applied fix: Always restart watch after successful send to avoid stale-stream state and post-submit event loss.

## 2026-02-11 09:14:43 UTC
- User issue: Message history remained, but assistant reply did not arrive after send; repeated stream interrupted logs.
- Applied backend resilience: `WatchChat` now emits immediate pending/node snapshot on connect so frontend can recover missed interaction state after reconnect/reload.

## 2026-02-11 09:17:27 UTC
- Additional stabilization: Frontend bootstrap mount now uses `InitRun.bootstrapRunId` first to reduce duplicate run creation and watch race conditions.

## 2026-02-11 09:19:17 UTC
- Observed issue: Frontend watch repeatedly got `Stream interrupted` with zero events despite node placeholder existing.
- Root-cause hypothesis and fix: stale `ActiveRunID` reuse from `InitRun` could point to a run that no longer emits events; reuse is now guarded by actual active-state checks.

## 2026-02-11 09:28:39 UTC
- User request: Re-define responsibilities and clean architecture instead of adding incremental patches.
- Applied cleanup:
  - `InitRun` now only initializes session/context.
  - Frontend explicitly starts bootstrap worker via `StartRun`.
  - Chat stream hook simplified to single-pass lifecycle (no layered retry state machine).
- Intent: remove hidden orchestration and make ownership boundaries explicit across gateway/worker/frontend.

## 2026-02-11 09:34:30 UTC
- User request: Strip down more aggressively and reduce accumulated complexity.
- Applied simplification: removed non-essential frontend branches (test-node action, debug logging plumbing, retry-heavy stream wrapper behavior) and kept only explicit bootstrap start/watch/send flow.

## 2026-02-11 09:47:40 UTC
- User intent: Subscribe/send should be isolated per LLM chat node via ID, not fragile run-channel coupling.
- Architecture direction agreed: introduce `conversation_id` as the chat interaction key; keep run execution generic while chat transport is replayable and resumable by conversation.
- Implemented boundary:
  - Core gateway publishes run events into conversation logs.
  - Frontend watch/send APIs carry `conversationId`.
  - Node controller owns node<->conversation mapping.
- Trade-off: conversation IDs can be rebound after run start; gateway now migrates prior conversation log when mapping changes to avoid early-event loss.

## 2026-02-11 09:51:07 UTC
- User intent: Conversation logs should be saved by `llmInteraction`, not directly in gateway.
- Architectural adjustment: Gateway is now transport mapping only; interaction state (pending input + conversation event log) is centralized in `internal/llmInteraction`.
- Resulting boundary: `gateway_llm_chat` calls service methods for conversation lifecycle and no longer owns chat log storage structs.

## 2026-02-11 10:09:40 UTC
- User intent: Introduce explicit `project` unit in Core, allow same user to select project in frontend, and provide a "new project" action.
- Agreed migration style: Move to project-centric behavior now, while keeping existing session-shaped transport fields as compatibility aliases during transition.
- Applied architecture:
  - PipelineService gained project lifecycle RPCs (`ListProjects`, `CreateProject`, `SelectProject`).
  - Core store now persists project metadata (`project_id`, `project_name`, `is_active`) per user.
  - Frontend bootstrap flow became project-driven with selector + create button.
- Follow-up direction: remove remaining session naming/paths after project-only clients are stable.

## 2026-02-11 10:20:34 UTC
- User intent: remove all compatibility-preserving code and stop carrying session-era fallback behavior.
- Applied decision: runtime paths now treat project as the only context key in request preprocessing and frontend chat/run orchestration.
- Effect: old cookie/session fallback and alias helpers were removed from active flow; project selection/creation remains the primary entry point.

## 2026-02-15 02:01:21 UTC
- User intent: Make Core architecture easy for LLMs to read, explicitly covering gateway structure, worker stateless/runtime-injection model, and frontend transport split where interaction uses WebSocket + RPC schema.
- Applied change: Added a dedicated architecture markdown under `InsightifyCore/docs` with source references and a section proposing additional documentation topics.

## 2026-02-15 02:04:35 UTC
- User intent: Revisit the implementation quality of UI and artifact PostgreSQL persistence.
- Applied change:
  - UI Postgres store now validates `run_id`, prevents first-write race via `INSERT ... ON CONFLICT DO NOTHING` + `SELECT ... FOR UPDATE`, enforces op validation symmetry with memory store, and returns cloned `UiNode` values.
  - Artifact Postgres store now validates identifiers, normalizes nil content handling, uses a typed not-found error (`ErrNotFound`), and checks `rows.Err()` in list flow.

## 2026-02-15 03:08:58 UTC
- User intent: Introduce project-level layers so frontend can restore the last layer's nodes after reload, and include layer semantics in proto.
- Applied architecture:
  - Added `ui_layers` + current layer/run pointers to project state.
  - Added proto fields for project layer metadata and a UI RPC (`GetProjectDocument`) to resolve current layer document by `project_id`.
  - Frontend bootstrap now tries project-layer restoration first, then falls back to running bootstrap worker when no layer document exists.

## 2026-02-15 03:17:02 UTC
- User intent: Use `tab` terminology instead of `layer` for project UI grouping to improve clarity.
- Applied change: Renamed API/domain fields and RPC naming to `tab` while keeping persistence compatibility by migrating from legacy `layer` columns/JSON keys where present.

## 2026-02-15 03:18:18 UTC
- User intent: Remove all UI layer compatibility paths completely.
- Applied change: Deleted legacy layer JSON fields and SQL migration/read-compat blocks (`ui_layers`, `current_ui_layer_id`, `current_ui_run_id`) from project store model and postgres backend.

## 2026-02-15 04:41:59 UTC
- User intent: Remove all unnecessary fields and compatibility baggage; specifically drop `CurrentUITabRunID` entirely.
- Applied change: Eliminated redundant run pointer from proto/domain/storage/frontend contracts and switched current-tab resolution to rely only on `current_ui_tab_id` + `ui_tabs`.

## 2026-02-15 04:50:40 UTC
- User intent: Keep current tab id on frontend localStorage and request restore by that tab id.
- Applied change: Added `tab_id` to project-tab document request, frontend now sends stored tab hint per project, and Core resolves preferred tab if valid or falls back to current tab.

## 2026-02-15 04:53:33 UTC
- User intent: Remove `CurrentUITabID` from Core and update proto as needed.
- Applied change: Deleted current-tab pointer field from project state/proto/RPC, leaving tab selection to explicit requested `tab_id` or fallback to latest tab in `ui_tabs`.

## 2026-02-15 05:16:21 UTC
- User intent: Execute full migration to a Core-owned UI workspace model.
- Applied architecture:
  - Removed UI tab state from project domain/proto.
  - Added dedicated workspace/tab repository + service with PostgreSQL and memory backends.
  - Added UiService RPCs for workspace and tab lifecycle (`GetWorkspace`, `ListTabs`, `CreateTab`, `SelectTab`) and kept project-tab document restore path with optional `tab_id` hint.
  - Worker run completion now binds run IDs to the current workspace tab via workspace service.

## 2026-02-15 05:20:50 UTC
- User intent: Explicitly separate workspace RPC boundary as `UiWorkspaceService`.
- Applied change: Moved workspace/tab lifecycle RPCs out of `UiService` into `UiWorkspaceService`, added dedicated handler wiring, and split frontend client usage (`uiClient` vs `uiWorkspaceClient`).

## 2026-02-15 05:50:52 UTC
- User intent: Remove all backward compatibility from recent fixes.
- Applied change: Deleted legacy migration logic from workspace persistence (`project_states.ui_tabs` ingestion path) and removed remaining explicit compatibility annotation from frontend project contract.

## 2026-02-15 09:00:45 UTC
- User intent: Keep artifact URLs permanent (no TTL) and proceed with MinIO-backed artifact storage.
- Applied change: Added MinIO service to `docker-compose.yml` to provide local object storage infrastructure for the gateway artifact flow.
- Constraint note: Compose validation command could not be executed in this runtime due to missing Docker CLI.
