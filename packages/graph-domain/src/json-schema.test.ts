import { describe, expect, it } from "vitest";
import {
  FLOW_GRAPH_EXPANSION_JSON_SCHEMA,
  FLOW_GRAPH_GENERATION_JSON_SCHEMA,
  FLOW_GRAPH_JSON_SCHEMA,
  SEMANTIC_LAYOUT_PLAN_JSON_SCHEMA,
  flowNodeKindSchema,
  flowNodeSchema,
} from "./index.js";

// These fields are withheld from the model on purpose. Anything else that the
// domain accepts must also be offered to the generator, and this test is what
// keeps that true when a field is added.
const WITHHELD_FROM_MODEL = ["status", "codeSnippet"];

type JsonObject = Record<string, any>;
const nodeSchema = (FLOW_GRAPH_JSON_SCHEMA as JsonObject).properties.nodes.items;

describe("the JSON schema handed to a provider", () => {
  it("offers exactly the node fields the domain defines, minus the deliberate omissions", () => {
    const domainFields = Object.keys(flowNodeSchema.shape).filter(
      (field) => !WITHHELD_FROM_MODEL.includes(field)
    );
    expect([...Object.keys(nodeSchema.properties)].sort()).toEqual([...domainFields].sort());
  });

  it("withholds the fields a static snapshot cannot assert", () => {
    for (const field of WITHHELD_FROM_MODEL) {
      expect(nodeSchema.properties).not.toHaveProperty(field);
    }
  });

  it("accepts every node kind the domain accepts", () => {
    expect(nodeSchema.properties.kind.enum).toEqual([...flowNodeKindSchema.options]);
  });

  it("marks every optional domain field optional, and no others", () => {
    const required = Object.entries(flowNodeSchema.shape)
      .filter(([field, schema]) => !schema.safeParse(undefined).success && !WITHHELD_FROM_MODEL.includes(field))
      .map(([field]) => field);
    expect([...nodeSchema.required].sort()).toEqual([...required].sort());
  });

  it("keeps the id pattern that the domain enforces on both branches of parentId", () => {
    const pattern = "^[a-z][a-z0-9-]{0,39}$";
    expect(nodeSchema.properties.id.pattern).toBe(pattern);
    expect(nodeSchema.properties.parentId.anyOf).toEqual([
      { type: "string", pattern },
      { type: "null" },
    ]);
  });

  it("forbids invented properties everywhere, as structured output requires", () => {
    const objects: JsonObject[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node === null || typeof node !== "object") return;
      const record = node as JsonObject;
      if (record.type === "object") objects.push(record);
      Object.values(record).forEach(walk);
    };
    walk(FLOW_GRAPH_GENERATION_JSON_SCHEMA);
    expect(objects.length).toBeGreaterThan(3);
    for (const object of objects) expect(object.additionalProperties).toBe(false);
  });

  it("carries no $schema or $ref that a provider would have to resolve", () => {
    const serialised = JSON.stringify(FLOW_GRAPH_GENERATION_JSON_SCHEMA);
    expect(serialised).not.toContain("$schema");
    expect(serialised).not.toContain("$ref");
    expect(serialised).not.toContain("$defs");
  });

  it("expresses a fixed version as an enum rather than draft-7 const", () => {
    expect((SEMANTIC_LAYOUT_PLAN_JSON_SCHEMA as JsonObject).properties.version).toEqual({
      type: "number",
      enum: [1],
    });
  });

  it("is frozen, so one run cannot change what a later run asks for", () => {
    expect(Object.isFrozen(nodeSchema)).toBe(true);
    expect(Object.isFrozen(nodeSchema.properties.kind.enum)).toBe(true);
  });

  it("describes an expansion patch with the same node shape as a full generation", () => {
    expect((FLOW_GRAPH_EXPANSION_JSON_SCHEMA as JsonObject).properties.nodes.items).toEqual(nodeSchema);
  });
});
