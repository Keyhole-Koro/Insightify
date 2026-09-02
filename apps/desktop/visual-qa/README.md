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

The built-in warnings are intentionally heuristic. They flag a Room whose child
bounding box occupies less than 45% of its height, or whose median row/column
gap is more than 1.5 times the corresponding child size. Overlaps are computed
from painted node regions instead of the transparent parts of each positioning
wrapper. The JSON keeps all raw measurements so agents can make a different
judgment rather than treating any warning as truth.
