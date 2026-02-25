# UI Restore / Cache / Sync E2E Test Guide

This document explains what each Playwright test verifies, why it matters, and
what a failure usually means.

Location:

- Specs: `tests/e2e/specs`
- Shared mock backend: `tests/e2e/helpers/mockBackend.mjs`

## Scope

These E2E tests validate the frontend behavior for three critical flows:

1. Restore decision logic (`Restore` reason + run identity)
2. Cache metadata handling logic (server document is always authoritative)
3. UI sync reliability (`ApplyOps` retry and eventual convergence)

The tests run against the real app UI (`InsightifyWeb`) with mocked RPC/WebSocket
responses, so they verify integration behavior in the browser without requiring
full backend services.

## How To Run Locally

```bash
cd tests/e2e
npm test
```

Playwright starts the web app automatically using `playwright.config.mjs`.

## Test Matrix

### `specs/restore_reason.spec.mjs`

#### `RESOLVED shows restore success`

What it verifies:

- `UiWorkspaceService/Restore` returns `UI_RESTORE_REASON_RESOLVED`
- Frontend reports restore success in the status UI
- Restored server document is rendered on the canvas

Why this exists:

- Ensures "successful restore" is treated as a first-class path and visible to users.
- Protects against regressions where restore succeeds internally but UI does not reflect it.

Typical failure signals:

- Restore reason parsing mismatch
- Node/message mapping regression
- Restore status UI regression

#### `NO_RUN falls back to bootstrap init`

What it verifies:

- `Restore` returns `UI_RESTORE_REASON_NO_RUN`
- Frontend does not attempt partial restore
- Frontend falls back to bootstrap initialization and shows fallback status

Why this exists:

- Prevents invalid/empty restore from leaving the UI in an undefined state.

Typical failure signals:

- Missing fallback invocation
- Wrong reason handling branch
- Status message regression

### `specs/restore_cache_hit_miss.spec.mjs`

#### `uses server document even when local meta matches`

What it verifies:

- Browser cache exists for the project/tab
- Cached metadata (`runId`, `documentHash`) can exist without changing restore authority
- Frontend still restores from server source

Why this exists:

- Protects against regressions that accidentally trust browser document payload over server state.

Typical failure signals:

- Cache read/parse regression
- Local storage key mismatch
- Server document unexpectedly bypassed

#### `uses server when local meta hash mismatches`

What it verifies:

- Browser cache exists but `documentHash` does not match the server hash
- Frontend uses server document
- UI shows server-origin restore state

Why this exists:

- Guarantees cache correctness over cache speed.
- Prevents stale document resurrection after schema or content change.

Typical failure signals:

- Incorrect cache trust logic
- Hash normalization bug
- Server document not applied after cache miss

### `specs/sync_applyops_retry.spec.mjs`

#### `sync retries apply ops and converges after transient failures`

What it verifies:

- `ApplyOps` fails transiently (HTTP 500) on early attempts
- Frontend retry queue resends and eventually succeeds
- UI converges to final state (assistant message appears)

Why this exists:

- Validates resilience under temporary network/backend instability.
- Protects against dropped UI operations and permanent divergence.

Typical failure signals:

- Retry backoff/queue bug
- Lost ops after first failure
- Run-version or sync-state regression

## Shared Mocking Model

`tests/e2e/helpers/mockBackend.mjs` provides:

- Connect RPC route interception by service/method path
- Mock WebSocket for interaction events (`wait_state`, `send_ack`, `close_ack`)
- Optional per-test behavior overrides (`restoreResponse`, `applyOpsHandler`)
- Local cache seeding helper (`seedRestoreCache`)

This keeps each spec focused on behavior, not setup plumbing.

## Contract Coverage Summary

These tests collectively enforce the following contracts:

- Restore eligibility is decided by `reason` and `runId`.
- Cache usage requires exact `runId + documentHash` match.
- Browser cache stores metadata only; server document is always authoritative.
- Temporary `ApplyOps` failures must not lose final UI state.
- Restore outcome must be explicit and user-visible in the frontend.
