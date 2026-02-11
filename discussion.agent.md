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
