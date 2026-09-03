import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ImplementationOutline } from "@insightify/graph-domain";
import { ImplementationTree } from "./ImplementationTree.js";

const outline: ImplementationOutline = {
  entrypoint: "verifySession",
  source: { path: "src/guard.ts", symbol: "verifySession" },
  steps: [
    {
      id: "validate-token",
      title: "Validate token",
      summary: "Checks the token before loading a session.",
      kind: "condition",
      inputs: ["bearer token"],
      outputs: ["verified claims"],
      children: [
        {
          id: "verify-signature",
          title: "Verify signature",
          summary: "Checks the signing key.",
          kind: "call",
        },
      ],
    },
  ],
};

describe("ImplementationTree", () => {
  it("renders semantic operations as controls instead of a preformatted text tree", () => {
    const html = renderToStaticMarkup(<ImplementationTree outline={outline} />);
    expect(html).toContain('data-vqa="implementation-tree"');
    expect(html).toContain('data-vqa-step-id="validate-token"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("<pre");
  });

  it("keeps children hidden until their parent is expanded", () => {
    const html = renderToStaticMarkup(<ImplementationTree outline={outline} />);
    expect(html).not.toContain('data-vqa-step-id="verify-signature"');
  });
});
