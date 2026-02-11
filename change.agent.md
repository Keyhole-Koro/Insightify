# change.agent.md

This file is the agent change log. Append each new change as a new entry.

## 2026-02-11 07:28:53 UTC
- Timestamp: 2026-02-11 07:28:53 UTC
- Agent: codex
- Summary: Rewired frontend bootstrap entrypoint to `useBootstrap` and restored full bootstrap chat flow orchestration from Home page.
- Changed Files:
  - InsightifyWeb/src/pages/home/useBootstrap.ts
  - InsightifyWeb/src/pages/Home.tsx
  - change.agent.md
- Notes: `Home` now imports and uses `useBootstrap`; hook initializes session, starts bootstrap worker, watches chat events, and handles need-input/send loop. Verified with `npm run build` and core regression tests.

## 2026-02-11 07:24:57 UTC
- Timestamp: 2026-02-11 07:24:57 UTC
- Agent: codex
- Summary: Added explicit UI SDK interaction methods (`NeedUserInput` / `Followup`) and switched bootstrap worker node rendering to those SDK methods.
- Changed Files:
  - InsightifyCore/internal/ui/chat_interaction.go
  - InsightifyCore/internal/ui/node_builders_chat.go
  - InsightifyCore/internal/ui/sdk_test.go
  - InsightifyCore/internal/workers/plan/bootstrap.go
  - change.agent.md
- Notes: Worker now constructs interaction state through UI SDK methods rather than ad-hoc node mutation logic in gateway. Core tests pass: `go test ./internal/ui ./internal/workers/plan ./cmd/api ./internal/runner`.

## 2026-02-11 07:16:12 UTC
- Timestamp: 2026-02-11 07:16:12 UTC
- Agent: codex
- Summary: Moved chat-node state ownership further into worker/UI SDK by making bootstrap build/send user+assistant node state and removing gateway-side user-reply node mutation.
- Changed Files:
  - InsightifyCore/internal/ui/node_builders_chat.go
  - InsightifyCore/internal/workers/plan/bootstrap.go
  - InsightifyCore/cmd/api/gateway_llm_chat.go
  - InsightifyCore/cmd/api/gateway_run_execute.go
  - change.agent.md
- Notes: Added `ui.BuildChatNode(...)`; bootstrap now emits node state containing user message (when input exists) plus assistant message via `ui.SendUpsertNode`, and gateway no longer appends user messages directly. Verified with `go test ./cmd/api ./internal/runner ./internal/workers/plan ./internal/ui` and `npm run build`.

## 2026-02-11 07:13:59 UTC
- Timestamp: 2026-02-11 07:13:59 UTC
- Agent: codex
- Summary: Strengthened core-owned interaction flow by reflecting user replies into run node state before follow-up execution and pushing node update events from core.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_llm_chat.go
  - InsightifyCore/cmd/api/gateway_run_execute.go
  - change.agent.md
- Notes: After `waitPendingUserInput`, core now appends a `ROLE_USER` message to stored `UiNode` and emits `NODE_READY` before rerunning bootstrap follow-up, so frontend receives user-input/follow-up transition from core state. Verified with `go test ./cmd/api ./internal/runner ./internal/workers/plan ./internal/ui` and `npm run build`.

## 2026-02-11 07:10:00 UTC
- Timestamp: 2026-02-11 07:10:00 UTC
- Agent: codex
- Summary: Added UI SDK send primitive and switched bootstrap node delivery to emitter-based push from worker runtime context instead of relying only on returned output.
- Changed Files:
  - InsightifyCore/internal/ui/send.go
  - InsightifyCore/internal/workers/plan/bootstrap.go
  - InsightifyCore/cmd/api/gateway_run_execute.go
  - InsightifyCore/cmd/api/gateway_llm_chat.go
  - change.agent.md
- Notes: `bootstrap.Run` now calls `ui.SendUpsertNode(ctx, node)` for initial and final node states; gateway now injects a UI emitter into execution context and translates UI upsert events into run-node store updates + `NODE_READY` progress events for chat stream consumers. Verified with `go test ./cmd/api ./internal/runner ./internal/workers/plan ./internal/ui` and `npm run build`.

## 2026-02-11 07:06:46 UTC
- Timestamp: 2026-02-11 07:06:46 UTC
- Agent: codex
- Summary: Removed `is_bootstrap` control path and switched bootstrap runs to immediate node-first interactive flow (node ready event at run start, then need-input/follow-up loop).
- Changed Files:
  - InsightifyCore/internal/workers/plan/bootstrap.go
  - InsightifyCore/internal/workers/plan/bootstrap_test.go
  - InsightifyCore/internal/runner/types.go
  - InsightifyCore/internal/runner/registry_plan.go
  - InsightifyCore/internal/runner/registry_testing.go
  - InsightifyCore/internal/artifact/init_purpose.go
  - InsightifyCore/cmd/api/gateway_request_preprocess.go
  - InsightifyCore/cmd/api/gateway_start.go
  - InsightifyCore/cmd/api/gateway_run_execute.go
  - InsightifyCore/cmd/api/gateway_init.go
  - InsightifyCore/cmd/api/gateway_llm_chat.go
  - InsightifyWeb/src/pages/home/useInitPurposeNode.ts
  - change.agent.md
- Notes: `StartRun` no longer parses `params.is_bootstrap`; bootstrap worker now treats empty input as initial greeting unconditionally. Gateway emits `NODE_READY` progress at bootstrap run start so frontend can upsert the first LLM chat node immediately while the worker continues interactive wait/follow-up. Verified with `go test ./cmd/api ./internal/runner ./internal/workers/plan ./internal/artifact` and `npm run build`.

## 2026-02-11 06:52:53 UTC
- Timestamp: 2026-02-11 06:52:53 UTC
- Agent: codex
- Summary: Fully merged `source_scout` worker into bootstrap implementation and removed standalone scout worker/types.
- Changed Files:
  - InsightifyCore/internal/workers/plan/bootstrap.go
  - InsightifyCore/internal/runner/registry_testing.go
  - InsightifyCore/internal/workers/plan/source_scout.go (deleted)
  - InsightifyCore/internal/artifact/plan_source_scout.go (deleted)
  - change.agent.md
- Notes: Bootstrap now owns scout prompt + execution internally; `BootstrapIn` no longer carries scout input. Verified with `go test ./internal/workers/plan ./internal/runner ./cmd/api` and `npm run build`.

## 2026-02-11 06:48:14 UTC
- Timestamp: 2026-02-11 06:48:14 UTC
- Agent: codex
- Summary: Merged source-scout behavior into bootstrap worker flow and simplified plan registry dependencies so interactive bootstrap owns scout+chat+followup loop.
- Changed Files:
  - InsightifyCore/internal/workers/plan/bootstrap.go
  - InsightifyCore/internal/workers/plan/bootstrap_test.go
  - InsightifyCore/internal/runner/registry_plan.go
  - InsightifyCore/internal/runner/test_registry_plan_test.go
  - change.agent.md
- Notes: Removed `plan_source_scout` dependency from bootstrap specs; bootstrap now resolves scout internally before LLM follow-up decision. Kept `init_purpose` as compatibility alias while making `bootstrap` the primary worker key in DAG metadata/requirements. Verified with `go test ./internal/workers/plan ./internal/runner ./cmd/api` and `npm run build`.

## 2026-02-11 06:40:51 UTC
- Timestamp: 2026-02-11 06:40:51 UTC
- Agent: codex
- Summary: Switched bootstrap startup path to use `bootstrap` worker key (while keeping `init_purpose` compatibility alias) and aligned frontend init-purpose launcher to bootstrap naming.
- Changed Files:
  - InsightifyCore/internal/runner/registry_plan.go
  - InsightifyCore/cmd/api/gateway_run_execute.go
  - InsightifyCore/cmd/api/gateway_init.go
  - InsightifyWeb/src/pages/home/useInitPurposeNode.ts
  - change.agent.md
- Notes: `InitRun` now auto-launches `bootstrap`; frontend `useInitPurposeNode` launches `bootstrap` via `StartRun(params.is_bootstrap=true)`. Added back `init_purpose` registry alias to preserve existing compatibility/tests. Verified with `go test ./cmd/api ./internal/runner ./internal/workers/plan` and `npm run build`.

## 2026-02-11 06:21:07 UTC
- Timestamp: 2026-02-11 06:21:07 UTC
- Agent: codex
- Summary: Ensured bootstrap always creates an initial LLM chat node at run start and added coverage for bootstrap greeting node output.
- Changed Files:
  - InsightifyCore/internal/workers/plan/bootstrap.go
  - InsightifyCore/internal/workers/plan/bootstrap_test.go
  - change.agent.md
- Notes: `BootstrapPipeline.Run` now initializes `BootstrapOut.UINode` immediately with an initial `init-purpose-node`, then replaces it with final node state after bootstrap result. Verified with `go test ./internal/workers/plan ./cmd/api`.

## 2026-02-11 06:18:22 UTC
- Timestamp: 2026-02-11 06:18:22 UTC
- Agent: codex
- Summary: Switched init-purpose startup flow to explicitly call `StartRun(init_purpose)` from frontend and added `is_bootstrap` parameter support in core StartRun preprocessing.
- Changed Files:
  - InsightifyWeb/src/pages/home/useInitPurposeNode.ts
  - InsightifyCore/cmd/api/gateway_request_preprocess.go
  - InsightifyCore/cmd/api/gateway_start.go
  - change.agent.md
- Notes: Frontend no longer relies on `InitRun.bootstrapRunId` for init-purpose conversation start; it now launches `init_purpose` directly with `params.is_bootstrap=true`. Verified with `go test ./cmd/api` and `npm run build`.

## 2026-02-11 06:12:54 UTC
- Timestamp: 2026-02-11 06:12:54 UTC
- Agent: codex
- Summary: Removed frontend local-first LLM node bootstrap/update paths and switched `useInitPurposeNode` to treat RPC `ChatNode` as canonical node state.
- Changed Files:
  - InsightifyWeb/src/pages/home/useInitPurposeNode.ts
  - change.agent.md
- Notes: Deleted `ensureInitPurposeNode` local generation, removed duplicate `onNode` state mutation (`setMetaTitle`/`setSendLock`/manual message mirroring), and now hydrate node messages from RPC state. Verified with `npm run build`.

## 2026-02-11 06:06:34 UTC
- Timestamp: 2026-02-11 06:06:34 UTC
- Agent: codex
- Summary: Moved primary LLM chat node generation responsibility to worker output (`BootstrapOut.UINode`) and made gateway prefer worker-provided UI nodes for chat stream events.
- Changed Files:
  - InsightifyCore/internal/workers/plan/bootstrap.go
  - InsightifyCore/cmd/api/gateway_run_execute.go
  - InsightifyCore/cmd/api/gateway_llm_chat.go
  - change.agent.md
- Notes: Gateway now stores per-run node snapshots emitted by worker output and reuses them for `WatchChat` event mapping, with legacy builder kept as fallback. Verified with `go test ./cmd/api ./internal/workers/plan ./internal/runner ./internal/ui`.

## 2026-02-11 05:50:40 UTC
- Timestamp: 2026-02-11 05:50:40 UTC
- Agent: codex
- Summary: Split `internal/ui` into smaller files by responsibility (types, builders, emitter, proto mapping helpers) while preserving public API.
- Changed Files:
  - InsightifyCore/internal/ui/node_types.go
  - InsightifyCore/internal/ui/node_builders_chat.go
  - InsightifyCore/internal/ui/node_builders_content.go
  - InsightifyCore/internal/ui/emitter_types.go
  - InsightifyCore/internal/ui/emitter_context.go
  - InsightifyCore/internal/ui/proto.go
  - InsightifyCore/internal/ui/proto_node_type.go
  - InsightifyCore/internal/ui/proto_content.go
  - InsightifyCore/internal/ui/sdk_test.go
  - InsightifyCore/internal/ui/sdk.go (deleted)
  - InsightifyCore/internal/ui/emitter.go (deleted)
  - change.agent.md
- Notes: No behavioral change intended; refactor-only decomposition. Verified with `go test ./internal/ui ./cmd/api ./internal/runner ./internal/workers/plan` and `npm run build`.

## 2026-02-11 05:47:34 UTC
- Timestamp: 2026-02-11 05:47:34 UTC
- Agent: codex
- Summary: Registered all current UI node types (llm_chat/markdown/image/table) in Core UI SDK and aligned RPC/UI mapping to those types.
- Changed Files:
  - schema/proto/insightify/v1/llm_chat.proto
  - InsightifyCore/internal/ui/sdk.go
  - InsightifyCore/internal/ui/proto.go
  - InsightifyCore/internal/ui/sdk_test.go
  - InsightifyCore/gen/go/insightify/v1/llm_chat.pb.go
  - InsightifyCore/gen/go/insightify/v1/insightifyv1connect/llm_chat.connect.go
  - InsightifyWeb/src/gen/insightify/v1/llm_chat_pb.js
  - InsightifyWeb/src/gen/insightify/v1/llm_chat_connect.js
  - InsightifyWeb/src/api/coreApi/types.ts
  - InsightifyWeb/src/api/coreApi/index.ts
  - change.agent.md
- Notes: Added markdown/image/table proto states and enum variants, SDK builders (`BuildMarkdownNode`, `BuildImageNode`, `BuildTableNode`), and frontend parser mappings. Verified with `go test ./cmd/api ./internal/ui ./internal/runner ./internal/workers/plan` and `npm run build`.

## 2026-02-11 05:42:51 UTC
- Timestamp: 2026-02-11 05:42:51 UTC
- Agent: codex
- Summary: Added Core-side UI SDK (`internal/ui`) and switched chat node construction in gateway to use SDK builders instead of ad-hoc proto assembly.
- Changed Files:
  - InsightifyCore/internal/ui/sdk.go
  - InsightifyCore/internal/ui/emitter.go
  - InsightifyCore/internal/ui/proto.go
  - InsightifyCore/internal/ui/sdk_test.go
  - InsightifyCore/cmd/api/gateway_llm_chat.go
  - change.agent.md
- Notes: SDK introduces domain node/message types, context emitter interface, and proto conversion helper. Verified with `go test ./cmd/api ./internal/ui ./internal/runner ./internal/workers/plan` and `npm run build`.

## 2026-02-11 05:15:22 UTC
- Timestamp: 2026-02-11 05:15:22 UTC
- Agent: codex
- Summary: Updated frontend to consume Core-driven `UiNode` snapshots more directly and reduce local-first chat node creation.
- Changed Files:
  - InsightifyWeb/src/pages/home/useInitPurposeNode.ts
  - InsightifyWeb/src/hooks/useLLMNodeState.ts
  - InsightifyWeb/src/hooks/useStreamWatch.ts
  - change.agent.md
- Notes: Added node upsert from RPC `node` payload (`title`, `sendLocked`, `sendLockHint`, responding state), switched new `testllmChar` flow to start run first and let stream create/update node, and made stream cancellation run-scoped instead of global. Verified with `npm run build` and `go test ./cmd/api ./internal/runner ./internal/workers/plan`.

## 2026-02-11 05:11:15 UTC
- Timestamp: 2026-02-11 05:11:15 UTC
- Agent: codex
- Summary: Added RPC-side UI node interface for `llm_chat` and started streaming node snapshots from Core to frontend through `WatchChat`.
- Changed Files:
  - schema/proto/insightify/v1/llm_chat.proto
  - InsightifyCore/cmd/api/gateway_llm_chat.go
  - InsightifyCore/gen/go/insightify/v1/llm_chat.pb.go
  - InsightifyCore/gen/go/insightify/v1/insightifyv1connect/llm_chat.connect.go
  - InsightifyWeb/src/gen/insightify/v1/llm_chat_pb.js
  - InsightifyWeb/src/gen/insightify/v1/llm_chat_connect.js
  - InsightifyWeb/src/api/coreApi/types.ts
  - InsightifyWeb/src/api/coreApi/index.ts
  - InsightifyWeb/src/hooks/useStreamWatch.ts
  - InsightifyWeb/src/pages/home/useInitPurposeNode.ts
  - change.agent.md
- Notes: `ChatEvent` now includes `node` (`UiNode`) with `UiLlmChatState`; frontend parser maps enum values and can consume node snapshots while keeping existing text-event flow. Verified with `go test ./cmd/api ./internal/runner ./internal/workers/plan` and `npm run build`.

## 2026-02-11 02:37:55 UTC
- Timestamp: 2026-02-11 02:37:55 UTC
- Agent: codex
- Summary: Added frontend stream-resume guard for LLM chat nodes so follow-up replies are still received when chat stream is not active at send time.
- Changed Files:
  - InsightifyWeb/src/pages/home/useInitPurposeNode.ts
  - change.agent.md
- Notes: Added per-node `streamingByNodeRef`; after `sendChatMessage` acceptance, auto-restarts `WatchChat` for that node if stream is inactive. Verified with `npm run build`.

## 2026-02-11 02:27:33 UTC
- Timestamp: 2026-02-11 02:27:33 UTC
- Agent: codex
- Summary: Removed single-active-run session gate so frontend can start `testllmChar` without `already has an active run`.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_run_execute.go
  - InsightifyCore/cmd/api/gateway_init.go
  - change.agent.md
- Notes: `launchWorkerRun` no longer blocks when session is running; `Running` flag now mirrors whether `ActiveRunID` is set. Verified with `go test ./cmd/api ./internal/runner ./internal/workers/plan`.

## 2026-02-11 02:21:29 UTC
- Timestamp: 2026-02-11 02:21:29 UTC
- Agent: codex
- Summary: Added gateway run-context regression test to ensure `testllmChar` is present in resolver composition.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_run_context_test.go
  - change.agent.md
- Notes: Test configures isolated repos dir and asserts `NewRunContext(...).Env.Resolver.Get(\"testllmChar\")` succeeds. Verified with `go test ./cmd/api ./internal/runner`.

## 2026-02-11 02:17:17 UTC
- Timestamp: 2026-02-11 02:17:17 UTC
- Agent: codex
- Summary: Split `testllmChar` out of the plan registry into a dedicated test registry and wired resolver composition to include it.
- Changed Files:
  - InsightifyCore/internal/runner/registry_plan.go
  - InsightifyCore/internal/runner/registry_testing.go
  - InsightifyCore/internal/runner/test_registry_plan_test.go
  - InsightifyCore/internal/runner/test_registry_test_test.go
  - InsightifyCore/cmd/api/gateway_run_context.go
  - change.agent.md
- Notes: `BuildRegistryTest` now owns `testllmChar`; gateway resolver merges architecture/codebase/external/plan/test registries. Verified with `go test ./internal/runner ./cmd/api ./internal/workers/plan`.

## 2026-02-11 02:15:27 UTC
- Timestamp: 2026-02-11 02:15:27 UTC
- Agent: codex
- Summary: Added a test interactive worker `testllmChar` and wired frontend LLM chat node creation to start and stream that worker via LlmChat flow.
- Changed Files:
  - InsightifyCore/internal/runner/registry_plan.go
  - InsightifyCore/internal/runner/test_registry_plan_test.go
  - InsightifyWeb/src/pages/home/useInitPurposeNode.ts
  - change.agent.md
- Notes: New LLM chat nodes now call `StartRun(workerKey=testllmChar)` then subscribe stream and continue through `sendChatMessage`. Verified with `go test ./internal/runner ./cmd/api ./internal/workers/plan` and `npm run build`.

## 2026-02-11 02:11:14 UTC
- Timestamp: 2026-02-11 02:11:14 UTC
- Agent: codex
- Summary: Consolidated interactive input flow under `LlmChatService`, introduced `internal/llmInteraction` service interface usage, and switched frontend init-purpose chat flow to `watchChat/sendMessage`.
- Changed Files:
  - InsightifyCore/internal/llmInteraction/handler.go
  - InsightifyCore/cmd/api/gateway_llm_chat.go
  - InsightifyCore/cmd/api/gateway_request_preprocess.go
  - InsightifyWeb/src/api/coreApi/client.ts
  - InsightifyWeb/src/api/coreApi/index.ts
  - InsightifyWeb/src/api/coreApi/types.ts
  - InsightifyWeb/src/hooks/useStreamWatch.ts
  - InsightifyWeb/src/pages/home/useInitPurposeNode.ts
  - InsightifyWeb/src/hooks/index.ts
  - InsightifyWeb/src/types/gen-modules.d.ts
  - change.agent.md
- Notes: Removed obsolete pending-registration preprocess helper, kept `respondNeedUserInput` as a compatibility wrapper to `sendChatMessage`, verified with `go test ./cmd/api ./internal/runner ./internal/workers/plan ./internal/llmInteraction` and `npm run build`.

## 2026-02-11 00:46:55 UTC
- Timestamp: 2026-02-11 00:46:55 UTC
- Agent: codex
- Summary: Moved all pending input store/wait/submit logic from `gateway_need_input.go` into `gateway_llm_chat.go`.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_llm_chat.go
  - InsightifyCore/cmd/api/gateway_need_input.go (deleted)
  - change.agent.md
- Notes: Kept function names for compatibility with existing `run_execute` call sites. Verified with `go test ./cmd/api ./internal/runner ./internal/workers/plan`.

## 2026-02-11 00:37:57 UTC
- Timestamp: 2026-02-11 00:37:57 UTC
- Agent: codex
- Summary: Unified `NeedUserInput` with `LlmChatService.SendMessage` submission path and moved session/pending normalization helpers into preprocess.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_request_preprocess.go
  - InsightifyCore/cmd/api/gateway_need_input.go
  - InsightifyCore/cmd/api/gateway_llm_chat.go
  - InsightifyCore/cmd/api/test_gateway_need_user_input_rpc.go
  - change.agent.md
- Notes: `NeedUserInput` now calls shared `submitInteractiveInput`. Verified with `go test ./cmd/api ./internal/runner ./internal/workers/plan`.

## 2026-02-11 00:35:20 UTC
- Timestamp: 2026-02-11 00:35:20 UTC
- Agent: codex
- Summary: Added `LlmChatService` RPC contract and backend implementation for chat event streaming + follow-up input submission.
- Changed Files:
  - schema/proto/insightify/v1/llm_chat.proto
  - InsightifyCore/cmd/api/gateway_llm_chat.go
  - InsightifyCore/cmd/api/gateway_need_input.go
  - InsightifyCore/cmd/api/server.go
  - InsightifyCore/cmd/api/gateway_contract.go
  - InsightifyCore/gen/go/insightify/v1/llm_chat.pb.go
  - InsightifyCore/gen/go/insightify/v1/insightifyv1connect/llm_chat.connect.go
  - InsightifyCore/gen/go/insightify/v1/pipeline.pb.go
  - InsightifyCore/gen/go/insightify/v1/insightifyv1connect/pipeline.connect.go
  - InsightifyWeb/src/gen/insightify/v1/llm_chat_pb.js
  - InsightifyWeb/src/gen/insightify/v1/llm_chat_connect.js
  - change.agent.md
- Notes: Generated code with `/go/bin/buf generate`. Verified with `go test ./cmd/api ./internal/runner ./internal/workers/plan` and `npm run build`.

## 2026-02-10 08:43:43 UTC
- Timestamp: 2026-02-10 08:43:43 UTC
- Agent: codex
- Summary: Extracted pending-input trim/validation into dedicated preprocess helpers.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_need_input.go
  - change.agent.md
- Notes: Added intent comments around normalize logic and reused helpers in register/submit/wait/clear paths. Verified with `go test ./cmd/api`.

## 2026-02-10 08:42:49 UTC
- Timestamp: 2026-02-10 08:42:49 UTC
- Agent: codex
- Summary: Added `prepareInitRun` preprocessor and refactored `InitRun` to use it.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_request_preprocess.go
  - InsightifyCore/cmd/api/gateway_init.go
  - change.agent.md
- Notes: Logic unchanged; only preprocessing extraction. Verified with `go test ./cmd/api`.

## 2026-02-10 08:41:45 UTC
- Timestamp: 2026-02-10 08:41:45 UTC
- Agent: codex
- Summary: Abstracted run source filesystem registration from single `repoPath` to `sourcePaths`-based resolution.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_run_context.go
  - InsightifyCore/internal/runner/types.go
  - change.agent.md
- Notes: Kept compatibility by mapping primary source to existing `RepoRoot`/`RepoFS` fields and added `Env.SourcePaths`. Verified with `go test ./cmd/api ./internal/runner`.

## 2026-02-10 08:39:25 UTC
- Timestamp: 2026-02-10 08:39:25 UTC
- Agent: codex
- Summary: Removed `normalizeWorkerKey` helper as requested and kept default worker fallback inline in `StartRun`.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_request_preprocess.go
  - InsightifyCore/cmd/api/gateway_start.go
  - change.agent.md
- Notes: Verified with `go test ./cmd/api`.

## 2026-02-10 08:38:17 UTC
- Timestamp: 2026-02-10 08:38:17 UTC
- Agent: codex
- Summary: Centralized repeated session/run pre-processing for `StartRun` and `NeedUserInput`.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_request_preprocess.go
  - InsightifyCore/cmd/api/gateway_start.go
  - InsightifyCore/cmd/api/test_gateway_need_user_input_rpc.go
  - change.agent.md
- Notes: Added intent comments around resolve/normalize logic. Verified with `go test ./cmd/api`.

## 2026-02-10 08:35:13 UTC
- Timestamp: 2026-02-10 08:35:13 UTC
- Agent: codex
- Summary: Removed `StartRun` special-case branch for `init_purpose/plan_pipeline` and unified run launch through `launchWorkerRun`.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_start.go
  - change.agent.md
- Notes: Keeps interactive behavior via shared `launchWorkerRun` path. Verified with `go test ./cmd/api ./internal/runner ./internal/workers/plan`.

## 2026-02-10 08:32:41 UTC
- Timestamp: 2026-02-10 08:32:41 UTC
- Agent: codex
- Summary: Promoted `init_purpose` to the primary interactive worker and removed `test_pipeline` handling from `StartRun`.
- Changed Files:
  - InsightifyCore/internal/runner/registry_plan.go
  - InsightifyCore/internal/runner/test_registry_plan_test.go
  - InsightifyCore/cmd/api/gateway_start.go
  - InsightifyCore/cmd/api/gateway_init.go
  - InsightifyCore/cmd/api/gateway_run_execute.go
  - InsightifyCore/cmd/api/test_gateway_need_input_test.go
  - change.agent.md
- Notes: Kept `plan_pipeline` as a legacy alias for compatibility. Verified with `go test ./cmd/api ./internal/runner ./internal/workers/plan`.

## 2026-02-10 08:26:59 UTC
- Timestamp: 2026-02-10 08:26:59 UTC
- Agent: codex
- Summary: Removed repo-name inference logic (`inferRepoName`) from gateway session handling.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_session.go
  - InsightifyCore/cmd/api/gateway_init.go
  - InsightifyCore/cmd/api/gateway_run_execute.go
  - change.agent.md
- Notes: `repo_url` is still preserved; repo name is no longer auto-derived from URL. Verified with `go test ./cmd/api`.

## 2026-02-10 08:21:35 UTC
- Timestamp: 2026-02-10 08:21:35 UTC
- Agent: codex
- Summary: Rewrote AGENT guidance and agent memo files in English.
- Changed Files:
  - AGENT.md
  - change.agent.md
  - discussion.agent.md
- Notes: Translation-only update. No runtime behavior changed.

## 2026-02-10 08:21:01 UTC
- Timestamp: 2026-02-10 08:21:01 UTC
- Agent: codex
- Summary: Added `AGENT.md` and defined agent operating rules (change log, discussion notes, code convention).
- Changed Files:
  - AGENT.md
  - change.agent.md
  - discussion.agent.md
- Notes: Initial template setup.

## 2026-02-11 07:34:15 UTC
- Timestamp: 2026-02-11 07:34:15 UTC
- Agent: codex
- Summary: Split `useBootstrap` responsibilities into dedicated hooks for session initialization, RPC node synchronization, and runtime interaction handling.
- Changed Files:
  - InsightifyWeb/src/pages/home/useBootstrap.ts
  - InsightifyWeb/src/pages/home/bootstrapConstants.ts
  - InsightifyWeb/src/pages/home/useBootstrapSession.ts
  - InsightifyWeb/src/pages/home/useBootstrapNodeSync.ts
  - InsightifyWeb/src/pages/home/useBootstrapRuntime.ts
  - change.agent.md
- Notes: Behavior preserved while reducing hook size. Verified with `cd InsightifyWeb && npm run build`.

## 2026-02-11 08:46:34 UTC
- Timestamp: 2026-02-11 08:46:34 UTC
- Agent: codex
- Summary: Generalized frontend runtime hooks so session management, RPC node sync, and run/send/stream control are reusable and no longer bootstrap-specific by naming/design.
- Changed Files:
  - InsightifyWeb/src/pages/home/useBootstrap.ts
  - InsightifyWeb/src/pages/home/useRunSession.ts
  - InsightifyWeb/src/pages/home/useRpcChatNodeSync.ts
  - InsightifyWeb/src/pages/home/useChatRunController.ts
  - InsightifyWeb/src/pages/home/bootstrapConstants.ts (deleted)
  - InsightifyWeb/src/pages/home/useBootstrapSession.ts (deleted)
  - InsightifyWeb/src/pages/home/useBootstrapNodeSync.ts (deleted)
  - InsightifyWeb/src/pages/home/useBootstrapRuntime.ts (deleted)
  - change.agent.md
- Notes: `useBootstrap` now composes generic hooks with bootstrap-specific constants only. Verified with `cd InsightifyWeb && npm run build`.

## 2026-02-11 08:50:26 UTC
- Timestamp: 2026-02-11 08:50:26 UTC
- Agent: codex
- Summary: Moved generalized runtime hooks out of `pages/home` into shared `src/hooks/chat` so they are not Home-specific.
- Changed Files:
  - InsightifyWeb/src/hooks/chat/useRunSession.ts
  - InsightifyWeb/src/hooks/chat/useRpcChatNodeSync.ts
  - InsightifyWeb/src/hooks/chat/useChatRunController.ts
  - InsightifyWeb/src/pages/home/useBootstrap.ts
  - change.agent.md
- Notes: Updated imports in `useBootstrap` to shared hooks path. Verified with `cd InsightifyWeb && npm run build`.

## 2026-02-11 08:57:58 UTC
- Timestamp: 2026-02-11 08:57:58 UTC
- Agent: codex
- Summary: Added detailed frontend diagnostic logging across session init, run start, stream lifecycle/events, RPC node upsert, and Home node state updates to debug missing LLM chat node after reload.
- Changed Files:
  - InsightifyWeb/src/hooks/useStreamWatch.ts
  - InsightifyWeb/src/hooks/chat/useChatRunController.ts
  - InsightifyWeb/src/hooks/chat/useRpcChatNodeSync.ts
  - InsightifyWeb/src/hooks/chat/useRunSession.ts
  - InsightifyWeb/src/pages/home/useBootstrap.ts
  - InsightifyWeb/src/pages/Home.tsx
  - change.agent.md
- Notes: Logs are gated by existing local/dev logging path (`[bootstrap]`) or `import.meta.env.DEV` (`[home]`). Verified with `cd InsightifyWeb && npm run build`.

## 2026-02-11 08:59:59 UTC
- Timestamp: 2026-02-11 08:59:59 UTC
- Agent: codex
- Summary: Fixed chat event enum mapping mismatch for Buf v2 generated enums and added frontend fallback node creation at stream start to prevent blank graph on reload.
- Changed Files:
  - InsightifyWeb/src/api/coreApi/client.ts
  - InsightifyWeb/src/hooks/useStreamWatch.ts
  - InsightifyWeb/src/hooks/chat/useChatRunController.ts
  - change.agent.md
- Notes: Root cause from logs: event type arrived effectively as enum values not matching old `EVENT_TYPE_*` constants; mapped to `UNSPECIFIED` and ignored. Verified with `cd InsightifyWeb && npm run build`.

## 2026-02-11 09:02:35 UTC
- Timestamp: 2026-02-11 09:02:35 UTC
- Agent: codex
- Summary: Added run-context compatibility guard to rebuild stale session `RunCtx` when required workers (e.g., `bootstrap`) are missing from resolver.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_session_store.go
  - change.agent.md
- Notes: Prevents "bootstrap worker is not registered" on old in-memory sessions after worker registry changes. Verified with `cd InsightifyCore && go test ./cmd/api ./internal/runner`.

## 2026-02-11 09:07:39 UTC
- Timestamp: 2026-02-11 09:07:39 UTC
- Agent: codex
- Summary: Stabilized chat watch lifecycle around `NEED_INPUT` and preserved local user history during RPC node upserts.
- Changed Files:
  - InsightifyWeb/src/hooks/useStreamWatch.ts
  - InsightifyWeb/src/hooks/chat/useRpcChatNodeSync.ts
  - change.agent.md
- Notes: `WatchChat` now pauses cleanly on `EVENT_TYPE_NEED_INPUT` (no reconnect error spam) and message sync now merges incoming RPC messages instead of replacing existing local history. Verified with `cd InsightifyWeb && npm run build`.

## 2026-02-11 09:11:44 UTC
- Timestamp: 2026-02-11 09:11:44 UTC
- Agent: codex
- Summary: Ensured watch stream is always restarted after successful message submission to avoid missing follow-up assistant events.
- Changed Files:
  - InsightifyWeb/src/hooks/chat/useChatRunController.ts
  - change.agent.md
- Notes: Removed conditional branch that skipped restart when `streamingByNodeRef` was true. `stream()` already aborts previous watcher for same run, so forced restart is safe. Verified with `cd InsightifyWeb && npm run build`.

## 2026-02-11 09:14:43 UTC
- Timestamp: 2026-02-11 09:14:43 UTC
- Agent: codex
- Summary: Added immediate chat-state snapshot emission in `WatchChat` so reconnecting clients can recover pending interaction/node state without relying on previously missed events.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_llm_chat.go
  - change.agent.md
- Notes: On stream connect, server now sends pending `NEED_INPUT` snapshot (with interaction_id/prompt/node) or node snapshot when available. Verified with `cd InsightifyCore && go test ./cmd/api ./internal/runner`.

## 2026-02-11 09:17:27 UTC
- Timestamp: 2026-02-11 09:17:27 UTC
- Agent: codex
- Summary: Removed redundant bootstrap `StartRun` on frontend mount; now prefers `bootstrapRunId` returned by `InitRun` to avoid duplicate bootstrap-run races.
- Changed Files:
  - InsightifyWeb/src/pages/home/useBootstrap.ts
  - change.agent.md
- Notes: Mount flow now watches server-created bootstrap run directly and only falls back to `StartRun(bootstrap)` when `bootstrapRunId` is empty. Verified with `cd InsightifyWeb && npm run build`.

## 2026-02-11 09:19:17 UTC
- Timestamp: 2026-02-11 09:19:17 UTC
- Agent: codex
- Summary: Hardened `InitRun` bootstrap-run reuse logic to avoid returning stale `ActiveRunID` that no longer emits events.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_init.go
  - change.agent.md
- Notes: `InitRun` now reuses active run only when `Running=true` and run is verifiably active (`pending input` exists or run channel is present). Otherwise it launches a fresh bootstrap run. Verified with `cd InsightifyCore && go test ./cmd/api ./internal/runner`.

## 2026-02-11 09:28:39 UTC
- Timestamp: 2026-02-11 09:28:39 UTC
- Agent: codex
- Summary: Cleaned bootstrap interaction architecture by removing implicit bootstrap run launch from `InitRun`, making frontend explicitly start bootstrap worker, and simplifying chat watch lifecycle to a single-pass stream model.
- Changed Files:
  - InsightifyCore/cmd/api/gateway_init.go
  - InsightifyWeb/src/pages/home/useBootstrap.ts
  - InsightifyWeb/src/hooks/useStreamWatch.ts
  - change.agent.md
- Notes: This reduces cross-layer responsibility overlap (InitRun no longer orchestrates worker execution). Verified with `cd InsightifyCore && go test ./cmd/api ./internal/runner` and `cd InsightifyWeb && npm run build`.

## 2026-02-11 09:34:30 UTC
- Timestamp: 2026-02-11 09:34:30 UTC
- Agent: codex
- Summary: Further reduced frontend complexity by removing test-node UI path, removing debug logging plumbing, and simplifying bootstrap to a single explicit run path.
- Changed Files:
  - InsightifyWeb/src/pages/home/useBootstrap.ts
  - InsightifyWeb/src/hooks/chat/useChatRunController.ts
  - InsightifyWeb/src/hooks/chat/useRpcChatNodeSync.ts
  - InsightifyWeb/src/hooks/chat/useRunSession.ts
  - InsightifyWeb/src/hooks/useStreamWatch.ts
  - InsightifyWeb/src/pages/Home.tsx
  - InsightifyWeb/src/pages/home/ActionPanel.tsx
  - change.agent.md
- Notes: Removed `testllmChar` action flow and most diagnostic-only branches. Verified with `cd InsightifyWeb && npm run build` and `cd InsightifyCore && go test ./cmd/api ./internal/runner`.

## 2026-02-11 09:47:40 UTC
- Timestamp: 2026-02-11 09:47:40 UTC
- Agent: codex
- Summary: Implemented conversation-scoped chat streaming (`conversation_id` + `from_seq`) and wired run-event publication into chat timeline so node-scoped subscriptions can resume/reconnect safely.
- Changed Files:
  - schema/proto/insightify/v1/llm_chat.proto
  - InsightifyCore/cmd/api/gateway_llm_chat.go
  - InsightifyCore/cmd/api/gateway_run_execute.go
  - InsightifyWeb/src/api/coreApi/types.ts
  - InsightifyWeb/src/api/coreApi/index.ts
  - InsightifyWeb/src/hooks/useStreamWatch.ts
  - InsightifyWeb/src/hooks/chat/useChatRunController.ts
  - change.agent.md
- Notes: Added migration-safe run->conversation rebinding in gateway (event history copy when conversation id changes), and frontend now binds each node to a stable conversation ID and passes it on watch/send. Verified with `cd InsightifyCore && go test ./cmd/api ./internal/runner` and `cd InsightifyWeb && npm run build`.

## 2026-02-11 09:51:07 UTC
- Timestamp: 2026-02-11 09:51:07 UTC
- Agent: codex
- Summary: Moved conversation log persistence/subscription from gateway layer into `internal/llmInteraction` so chat history is managed by the interaction domain service.
- Changed Files:
  - InsightifyCore/internal/llmInteraction/handler.go
  - InsightifyCore/internal/llmInteraction/conversation.go
  - InsightifyCore/cmd/api/gateway_llm_chat.go
  - change.agent.md
- Notes: `gateway_llm_chat` now delegates `EnsureConversation/ConversationIDByRun/RunIDByConversation/AppendChatEvent/SubscribeConversation` to `llmInteraction`. Verified with `cd InsightifyCore && go test ./cmd/api ./internal/llmInteraction ./internal/runner`.
