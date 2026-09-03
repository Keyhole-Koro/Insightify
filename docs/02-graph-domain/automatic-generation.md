# Automatic FlowFold Graph Generation

## Decision

Projectを選択しただけではAIを起動しない。保存済みGraphがあれば即座に復元し、なければempty stateに
`Generate with Codex` または `Generate with Antigravity` を表示する。ユーザーの明示操作で、現在選択している
providerへ一度だけ初期Graph生成を依頼する。

AIが決めるのはNode、包含関係、Edge、summary、evidence、コードから根拠を取れるNodeのImplementation Outlineに加え、
Nodeを意味的なAreaへまとめるSemantic Layout Planである。座標、余白、比率などの視覚的な数値はAIへ生成させず、同じGraphとPlanなら同じ
結果になるdeterministic layout compilerをDesktop側で適用する。これによりプロジェクト固有の構造を表現しつつ、
再生成時の不要な位置揺れとmodel固有の座標差を避ける。

## Pipeline

1. Desktop main processが選択Projectをopaque idから解決する。
2. Git管理対象と未追跡ファイルの一覧から、安全化したbounded snapshotを作る。
3. secret候補、dependency、binary、巨大ファイル、symlinkを除外し、snapshot hashを計算する。
4. Zod定義から導出したJSON Schemaを付けて選択providerを起動する。
5. CodexとAntigravity CLIは空の一時directoryから、prompt内のsnapshotだけを解析する。Codex turnはread-onlyかつnetwork disabledとする。
6. provider出力をZodで再検証し、参照切れ、重複id、self edgeを拒否する。
7. Layout PlanをJSON-safeな制約内で検証し、未知Nodeや重複割り当てを除外してArea DSLへcompileする。
8. 検証済みGraph、Layout Plan、生成layout、手動override、provider、snapshot hash、生成時刻をDesktop SQLiteへupsertする。
9. rendererへtyped eventを送り、同じcompiled Area DSLでroot、Room、inline展開を配置する。

初回生成はrootごとに子Nodeも作る。子を持たないPortalへEnterした場合は、同じpipelineをscope expansion modeで
実行する。providerは新規Node/Edgeと対象RoomのLayout Scopeからなるappend-only patchを返す。main processは
新規Nodeが指定Roomのdescendantであり、新規Edgeの片端が新規Nodeであること、Layout Scopeが対象Roomまたは
新規Roomだけを変更することを検証してから現在Documentへmergeする。

## Current MVP Contract

- Node: `id`, `title`, `summary`, `kind`, `parentId`, `evidence`, 任意の`tags`、`technology`、`implementation`
- Implementation Outline: exact entrypoint/sourceと、`phase`、`condition`、`call`、`side-effect`、`return`からなる
  最大3階層の意味ツリー。生のASTや座標は含めず、source pathはNodeの`evidence`にも存在しなければならない
- `status`と`codeSnippet`はprovider contractへ含めない。前者は静的snapshotが主張できない実行時の注釈、
  後者は`evidence`と重複しtoken costが大きい。どちらも手動編集で入れられ、再生成でも失われない
- provider へ渡すJSON SchemaはZod定義から生成する。Domainに存在してcontractから漏れるfieldは作れない
- Edge: `source`, `target`, `label`
- Semantic Layout Plan: scopeごとの`roomId`, Area間の`direction`, Areaの`id`/`label`/`nodeIds`/内部`direction`
- 座標、padding、gap、split ratio、regexはprovider contractへ含めない
- Graph全体のNode/Edge数に固定上限を置かない。rootはoverviewで3–5個を推奨
- Canvasには現在ScopeのNodeを表示し、Portalからchild ScopeへEnterできる
- empty PortalへEnterすると選択中providerがそのRoomを自動展開する
- Graph生成と通常のanchored conversationは別runとして扱う
- 再生成は現在のGraphを、検証と永続化が成功した時点で原子的に置換する

## Failure Behavior

snapshot、provider起動、schema validation、SQLite保存のどこかが失敗した場合、既存Graphは維持する。生成runを
failedとしてUIへ返し、未検証のJSONをGraphとして表示・保存しない。cancel時も既存Graphを変更しない。

## Next Steps

- 生成前snapshot previewと含有ファイルの除外操作
- 再生成結果を直接置換せずChangeSetとしてdiff表示
- evidenceからArtifact Linkへの昇格
- source symbol/lineをeditorへ直接開くArtifact Link
- 生成Graphと手動編集GraphのChangeSet diff
- snapshot hashによるstale表示と差分再解析
