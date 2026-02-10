# change.agent.md

This file is the agent change log. Append each new change as a new entry.

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
