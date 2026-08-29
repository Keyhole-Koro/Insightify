# Insightify

Insightify は、ソフトウェアを抽象から具体へ辿れる再帰的な Flow として設計し、Flow 上の任意の場所で
人間と AI が共同作業するための開発環境である。

中核の再帰キャンバス方式を **FlowFold** と呼ぶ。Compound Node は子要素を無限に展開する container ではなく、
独立した Scope / Room へ入るための Portal として扱う。子 Scope の複雑さは親 Scope のレイアウトへ伝播しない。

## Repository Structure

```text
apps/desktop/       Electron shell (main / preload / renderer) と renderer preview harness
packages/           Domain、Agent 抽象、Provider adapter、IPC contract
docs/               設計文書と Architecture Decision Record
```

パッケージ間の依存方向と、Node に依存してよい層の境界は
[依存関係ガイドライン](docs/architecture/dependency-rules.md) で定義する。

| Package | 責務 |
|---|---|
| [`graph-domain`](packages/graph-domain/) | FlowGraph schema、flow layout、scope projection、boundary port |
| [`agent-runtime`](packages/agent-runtime/) | provider 非依存の Agent event と capability |
| [`agent-codex`](packages/agent-codex/) | Codex app-server adapter |
| [`agent-antigravity-cli`](packages/agent-antigravity-cli/) | Antigravity CLI adapter |
| [`desktop-bridge`](packages/desktop-bridge/) | Main と Renderer の typed IPC contract |

## Development

```bash
bun install
bun dev
```

Renderer だけを Electron 抜きで動かす場合は preview harness を使う。stub した preload bridge と固定 Graph で
FlowFold canvas を操作できるので、boundary port、Portal fold、Enter/Leave の確認はここで足りる。

```bash
bun preview   # http://localhost:5199
```

Typecheck、test、パッケージング:

```bash
bun run typecheck
bun run test
bun run package
```

`bun test` は Bun 組み込みの test runner でスクリプトを上書きしてしまう。このリポジトリは Vitest を使うので
`bun run test` を使う。

Agent provider は起動時に probe する。使う方の CLI を先に install して認証しておく。

```bash
codex --version
agy --version
```

未検出の provider は UI 上に表示されたまま disabled になる。Antigravity の headless mode は対話的な承認要求を
公開しないため、Insightify から迂回するのではなく Antigravity CLI 側で権限を設定する。

初回起動時に Electron 内蔵の `node:sqlite` で `insightify.sqlite3` を user-data ディレクトリへ作成する。
リポジトリのパスは Renderer へ返さず、bridge は不透明な project ID だけを扱う。

## Documentation

設計文書は依存順に配置する。番号は実装優先度ではなく、概念を読む順序を表す。

| Directory | Scope |
|---|---|
| [`00-overview`](docs/00-overview/) | プロダクト全体、設計原則、用語、全体アーキテクチャ |
| [`01-flowfold`](docs/01-flowfold/) | Portal、Room、Semantic Zoom、layout、操作仕様 |
| [`02-graph-domain`](docs/02-graph-domain/) | Scope、Node、Port、Edge、Revision、ChangeSet |
| [`03-collaboration`](docs/03-collaboration/) | Anchor、Thread、ThreadMemory、Context Compiler |
| [`04-agent-runtime`](docs/04-agent-runtime/) | Agent Run、Local Runner、tool policy、worktree |
| [`05-branching`](docs/05-branching/) | Branch、read/write set、lease、conflict、merge |
| [`06-mvp`](docs/06-mvp/) | MVP、prototype、demo、評価計画 |
| [`architecture`](docs/architecture/) | 依存方向、境界、実装上の構造ルール |
| [`decisions`](docs/decisions/) | 個別の Architecture Decision Record |

最初に読む文書:

- [Insightify System Design](docs/00-overview/system-design.md)
- [Technology Stack and Runtime Architecture](docs/00-overview/technology-stack.md)
- [FlowFold Interaction Specification](docs/01-flowfold/interaction-spec.md)

## Naming

- **Insightify:** プロダクト全体
- **FlowFold:** 再帰的な Flow UI・構造モデル
- **Room:** Scope に入ったときの作業空間
- **Thread:** 人間と AI の継続的な対話
- **Agent Run:** AI が tool を使って行う一回の作業
- **ChangeSet:** Graph と Artifact に対する原子的な変更提案

## Relationship to Synthify

Insightify と Synthify は別サービスであり、リポジトリを分離している。コードの共有は現時点で存在しない。

将来 FlowFold canvas や `graph-domain` を共有する必要が出た場合は、submodule ではなく version 付きの
package として publish する。設計文書に残る「Synthify Hub」は、まだ実装の裏付けを持たない仮説として扱う。
