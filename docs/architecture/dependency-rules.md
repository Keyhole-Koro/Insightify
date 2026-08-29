# 依存関係アーキテクチャ・ガイドライン

## 概要

Insightify における各パッケージの責務、依存の方向、および契約の管理方法を定義する。目的は「変更しやすく、壊れにくく、
Desktop 固有の実装が UI 層へ漏れ出さない」状態を維持することである。

Insightify は Electron を採用しているため、**Node.js を触れる層と触れない層が同じ TypeScript として書ける**。
言語が同じであることは境界が無いことを意味しない。この文書はその境界を明示する。

---

## 1. 依存の基本原則

### 1.1 一方向依存の徹底（Dependency Rule）

依存は常に「外側から内側へ」向かう。

- **内側（Contract / Domain）:** `packages/graph-domain`, `packages/agent-runtime`
- **境界（Boundary）:** `packages/desktop-bridge`
- **Provider 実装（Node-only）:** `packages/agent-codex`, `packages/agent-antigravity-cli`
- **外側（App）:** `apps/desktop`

**禁止事項:**

- `packages/graph-domain` と `packages/agent-runtime` が他の workspace package を import すること。
- `packages/agent-runtime` が特定 provider（Codex / Antigravity）を知ること。依存は provider 実装 → `agent-runtime` の一方向。
- Renderer が `agent-codex` / `agent-antigravity-cli` を import すること。これらは `node:child_process` を持つ。
- Renderer が `electron` を直接 import すること。Preload が公開する `window.insightify` だけを使う。
- Main が Renderer のモジュールを import すること。

### 1.2 契約と実装の分離

`desktop-bridge` は「何ができるか（IPC channel と型）」だけを定義し、実装は Main に閉じる。
Renderer は `InsightifyDesktopApi` の型にだけ依存し、Electron IPC の存在を知らない。

---

## 2. プロジェクトの物理構造と実依存

### 2.1 プロジェクト構造マップ

```text
[Insightify root]
├─ packages/
│  ├─ graph-domain/     # FlowGraph schema, layout, scope projection, boundary ports
│  ├─ agent-runtime/    # provider 非依存の Agent event / capability 型
│  ├─ agent-codex/      # Codex app-server adapter (Node)
│  ├─ agent-antigravity-cli/  # Antigravity CLI adapter (Node)
│  └─ desktop-bridge/   # typed IPC contract (channel 名 + 入出力 schema)
│
└─ apps/
   └─ desktop/
      ├─ src/main/      # subprocess, filesystem, SQLite, provider 実行
      ├─ src/preload/   # contextBridge で desktop-bridge の API だけを公開
      ├─ src/renderer/  # FlowFold canvas (React)
      └─ preview/       # preload を stub した renderer harness
```

### 2.2 現在の実依存

| Package | 依存先 | 実行環境 |
|---|---|---|
| `graph-domain` | `zod` のみ | どこでも（Node / Browser 両対応） |
| `agent-runtime` | なし | どこでも |
| `desktop-bridge` | `graph-domain`, `agent-runtime`, `zod` | どこでも |
| `agent-codex` | `agent-runtime`, `node:*` | Node のみ |
| `agent-antigravity-cli` | `agent-runtime`, `node:*` | Node のみ |
| `apps/desktop` renderer | `graph-domain`, `agent-runtime`（型）, `desktop-bridge`（型）, `react` | Browser |

---

## 3. Browser-safe 境界

`graph-domain`、`agent-runtime`、`desktop-bridge` は Node built-in にも `electron` にも依存しない。
これは偶然ではなく維持すべき性質である。理由は 2 つある。

1. Renderer は sandbox で動く。Node 依存が混ざると preload 境界を迂回する経路ができる。
2. FlowFold renderer を将来 Web client と共有する場合、共有できるのはこの層だけになる。

`node:` から始まる import を新しく足すときは、そのパッケージが Node-only 側に属するかを先に確認する。

---

## 4. Semantic 状態と Layout 状態の分離

`FlowGraph` は Node、包含関係、Edge という**意味状態**を持つ。`GraphLayout` は Node id ごとの Scope-local な
`x/y` という**表示状態**を持つ。両者を混ぜない。

- Semantic Zoom、camera、selection は永続化しない view state である。
- 自動生成した座標は `layout`、ユーザーが手で動かした座標は `layoutOverrides` に分けて永続化する。
- 生成 AI は座標を返さない。返すのは `SemanticLayoutPlan`（Area への Node 割り当て）だけで、
  `resolveRoomLayoutRules` が Area DSL へ compile し、`createDefaultGraphLayout` が座標を決める。
- `defaultRoomLayoutRules` は plan が無いときの fallback であり、`kinds` と `tags` だけで判定する。
  特定の Node id を書かない。書くと、同じ id を持つ別 Project の配置が偶然変わる。
- `layoutEngineVersion` はその座標を作った compiler の版である。読み出し時に現在版と異なれば
  `layout` を再計算し、`layoutOverrides` は保持する。Document 上の version はこれ一つに限る。

---

## 5. Renderer 内部の構造

Renderer も内部を層に分ける。依存は上から下への一方向であり、下の層は上を知らない。

| 層 | 置き場所 | 責務 |
|---|---|---|
| Presentation | `App.tsx`, `components/` | 組み立てと描画のみ。導出も IO も行わない |
| Service (hooks) | `hooks/` | `useProjectGraph`（正本と保存）、`useAgentSession`（実行とイベント）、`useCanvasView`（view state）、`useFlowProjection`（描画用の導出）、`useNodeDrag` |
| Adapter | `lib/bridge.ts` | `window.insightify` に触れる唯一の場所 |
| Pure logic | `lib/` | `graph-edits`、`node-draft`、`drag-position`、`prompts`。React も DOM も使わず、単体テストできる |

**規約:**

- `window.insightify` を参照してよいのは `lib/bridge.ts` だけである。他は `useBridge()` を経由する。
- `lib/` の純関数は React を import しない。値から値への変換に留める。
- `useCanvasView` が持つ状態は永続化しない。保存されるのは `GeneratedFlowGraph` だけである（第 4 節）。
- `hooks/` は `components/` を import しない。共有する型は `lib/` に置く。

`useBridge()` は `BridgeContext` を先に見るため、Electron なしで Canvas を動かす場合は
実装を差し替えられる。`apps/desktop/preview/` の harness は `window.insightify` を stub して同じ役割を果たす。
