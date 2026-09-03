# Insightify Visual QA

This is the stable observation interface for humans and coding agents. It drives
the renderer-only preview, performs real DOM interactions in Electron Chromium,
captures screenshots, and writes geometry in screen pixels.

```bash
bun run visual:qa
bun run visual:qa -- --scenario room-expansion
bun run visual:qa -- --scenario room-expansion --out /tmp/my-visual-check
```

Each run writes outside the repository by default:

- `report.json` — machine-readable viewport, stage zoom/LOD, node and frame
  rectangles, rendered regions, containment, whitespace, overlaps, occupancy,
  row/column clusters, gap ratios, painted-area density, screenshot scale, and
  warnings.
- `report.md` — compact review with the screenshots embedded.
- one PNG for every scenario checkpoint.

Scenarios live in `visual-qa/scenarios`. Prefer stable `data-vqa` selectors over
CSS classes. A step can click a selector, click an element by text, dispatch a
wheel event, or evaluate a deliberately local expression. Every checkpoint is
measured after its interaction and animation wait.

The built-in warnings are intentionally heuristic, and their thresholds live in
the scenario under `thresholds` rather than inside the runner, so a scenario can
say what "too sparse" means for the layout it exercises. They flag a Room whose
child bounding box occupies too little of its height, or whose median row/column
gap is too large next to the child size. Overlaps are computed
from painted node regions instead of the transparent parts of each positioning
wrapper. The JSON keeps all raw measurements so agents can make a different
judgment rather than treating any warning as truth.

## Baselines

A run compares its warnings against `visual-qa/baselines/<scenario>.json` and
exits non-zero when a warning appears that the baseline does not have. Warnings
are compared by identity, not by the measurement they quote, so a card moving a
few pixels is not a regression while a card leaving its frame is.

```bash
bun run visual:qa                          # compare against the baseline
bun run visual:qa -- --update-baseline     # accept the current warnings
```

Update the baseline deliberately, in the same commit as the change that altered
it, so the diff records which warnings were accepted and why.
