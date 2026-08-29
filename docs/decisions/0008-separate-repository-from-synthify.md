# 0008: Separate Repository from Synthify

**Status:** Accepted  
**Date:** 2026-08-29

## Context

Insightify は Synthify の bun workspace 内で `apps/desktop` と `packages/*` として実装を始めた。
[Technology Stack](../00-overview/technology-stack.md) は Synthify backend を「Synthify Hub」として拡張する前提を
置き、package manager を「repository に合わせる」と決めていた。

実装を確認すると、この前提を支えるコードは存在しなかった。

- `apps/desktop/src` と `packages/*/src` に `fetch` / ConnectRPC / WebSocket が一切ない。Hub 層は未実装である。
- Synthify の proto namespace は `tree` / `item` / `document` / `workspace` / `billing` で構成され、
  graph / flow / room / thread / agent-run / changeset は存在しない。
- Synthify backend に graph / flow のドメインはない。
- Synthify の frontend は Insightify の package を一つも参照していない。

双方向に共有コードがゼロであり、ドメインも利用者も runtime も異なる。Synthify はドキュメントから知識ツリーを
作る server-authoritative な SaaS、Insightify はコードを FlowFold Graph として辿る local-first の Desktop である。

## Decision

Insightify を `Keyhole-Koro/Insightify` として独立したリポジトリに分離する。一つの bun workspace として
`apps/desktop` と `packages/*` を持ち、submodule は使わない。

共有コードが必要になった場合は、submodule ではなく version 付き package として publish する。

## Alternatives

- **Synthify の monorepo に残す:** 共有面が実際に存在すれば正しい。しかし現状ゼロであり、同居は
  「せっかくだから」で境界を越える判断（Insightify の Graph を Synthify の proto namespace に足す等）を誘発する。
  無関係なドメイン同士の結合は、後で剥がすのが最も高くつく。
- **umbrella repository + submodule:** 旧 `Insightify` リポジトリ（Core / Web / TraceViewer / LogMCP の 4 submodule）で
  一度採用し、2026-02 に submodule pointer ごと停止した。Synthify 側の `paper-in-paper` submodule も
  `package.json` / `next.config.ts` / `tsconfig` paths / `tsconfig` include の 4 箇所で配線され、
  パッケージ自身の `exports` を tsconfig paths で迂回している状態にある。共に変化するコードには向かない。
- **private registry で共有 package を切る:** 共有面が安定した時点では正しい。共有するものが無い現在は、
  publish の手間だけが残る。

## Consequences

- Insightify の CI は Electron/Vitest だけを扱い、Go / Docker Compose / Playwright billing suite を持ち込まない。
- Hub を前提にした `technology-stack.md`、ADR 0002、ADR 0005 の判断根拠は失効する。各文書に注記を入れた。
  cloud 層に着手する時点で再評価する。
- FlowFold renderer を Web client と共有する計画は、`packages/` への抽出と package publish の 2 段階になる。
  それまで `apps/desktop/preview/` の harness が Electron 非依存での動作確認を担う。
- 旧 `Insightify` リポジトリ（umbrella + 4 submodule、最終更新 2026-02-25）は継承しない。ドメインが
  workspace / tab / UI node であり、FlowFold とは対応関係を持たない。
