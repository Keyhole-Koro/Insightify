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
