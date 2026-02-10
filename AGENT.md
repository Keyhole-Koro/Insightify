# AGENT.md

Agents working on this project must follow the rules below.

## 1. Change Log (`change.agent.md`)

- Log every implementation change in `change.agent.md`.
- Add one entry per logical change.
- Each entry must include at least:
  - `Timestamp`
  - `Agent`
  - `Summary`
  - `Changed Files`
  - `Notes`

Recommended template:

```md
## YYYY-MM-DD HH:mm:ss UTC
- Timestamp: YYYY-MM-DD HH:mm:ss UTC
- Agent: codex
- Summary: 1-3 lines describing what changed
- Changed Files:
  - path/to/file1
  - path/to/file2
- Notes: test results, follow-ups, compatibility notes, etc.
```

## 2. Discussion Notes (`discussion.agent.md`)

- Record user decisions, intent, and constraints in `discussion.agent.md`.
- Review the latest notes before implementation and align proposals/design with them.
- Explicitly capture:
  - User goals
  - Approaches to avoid
  - Preferred trade-offs
  - Open questions

## 3. Code Rule (`resolve` / `normalize`)

- Add intent-revealing comments around logic that uses `resolve` or `normalize`.
- Briefly state what is being resolved/normalized and why it is needed.
- Avoid generic comments; explain behavioral intent.

Examples:

```ts
// Normalize worker key to avoid routing mismatch between legacy pipeline_id and new worker naming.
const workerKey = (request.workerKey ?? request.pipelineId ?? "").trim();
```

```go
// Resolve session ID from explicit request first, then cookie fallback for browser reconnect compatibility.
sessionID := resolveSessionID(req)
```
