# change.agent.md

This file is the agent change log. Append each new change as a new entry.

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
