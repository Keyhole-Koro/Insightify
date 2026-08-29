import { z } from "zod";

// Providers are handed a JSON Schema, not a Zod schema. Deriving it from the
// Zod definition keeps one description of a node: adding a field, tightening a
// pattern or renaming a kind can no longer be applied to one of the two and
// forgotten on the other.
export type ProviderJsonSchema = Record<string, unknown>;

export function toProviderJsonSchema(schema: z.ZodType): ProviderJsonSchema {
  const generated = z.toJSONSchema(schema, { target: "draft-7", io: "input" }) as ProviderJsonSchema;
  delete generated.$schema;
  // One schema object is shared by every run that uses it, so it is frozen:
  // an accidental in-place edit would otherwise change what later runs ask for.
  return deepFreeze(closeObjects(generated)) as ProviderJsonSchema;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  return Object.freeze(value);
}

// Structured-output providers reject a schema that would let the model invent
// properties, and Zod only emits the flag for strict objects. Applying it here
// keeps the domain schemas plain.
function closeObjects(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(closeObjects);
  if (node === null || typeof node !== "object") return node;
  const entries = Object.entries(node as Record<string, unknown>).map(
    ([key, value]) => [key, closeObjects(value)] as const
  );
  const result = Object.fromEntries(entries) as Record<string, unknown>;
  if (result.type === "object") result.additionalProperties = false;
  // Providers agree on `enum` far more widely than on draft-7's `const`.
  if ("const" in result && !("enum" in result)) {
    result.enum = [result.const];
    delete result.const;
  }
  return result;
}
