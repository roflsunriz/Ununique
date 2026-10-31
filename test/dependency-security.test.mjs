import { expect, test } from "bun:test";
import { createRequire } from "node:module";
import merge from "deepmerge";
import mergeUmd from "deepmerge/dist/umd.js";

const poisoned = () => JSON.parse('{"__proto__":{"isAdmin":true},"safe":1}');

for (const [name, deepmerge] of [
  ["CommonJS", merge],
  ["UMD", mergeUmd]
]) {
  test(`deepmerge ${name} rejects prototype poisoning while preserving ordinary merges`, () => {
    const nullPrototype = deepmerge(Object.create(null), poisoned());
    const hostileTarget = deepmerge(poisoned(), {});
    const nested = deepmerge({ session: null }, { session: poisoned() }).session;
    const arrayElement = deepmerge({}, { items: [poisoned()] }).items[0];
    for (const result of [nullPrototype, hostileTarget, nested, arrayElement]) {
      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      expect(result.isAdmin).toBeUndefined();
      expect(Object.hasOwn(result, "__proto__")).toBe(false);
      expect(result.safe).toBe(1);
    }
    expect(deepmerge({ nested: { a: 1 }, items: [1] }, { nested: { b: 2 }, items: [2] })).toEqual({
      nested: { a: 1, b: 2 },
      items: [1, 2]
    });
    expect({}.isAdmin).toBeUndefined();
  });
}

test("minimatch 3 does not amplify the reported globstar-parent pattern", () => {
  const require = createRequire(import.meta.url);
  const multimatchRequire = createRequire(require.resolve("multimatch"));
  const { Minimatch } = multimatchRequire("minimatch");
  for (const count of [1, 2, 4, 8, 16, 32, 64, 128]) {
    const compiled = new Minimatch("**/../a/b/".repeat(count) + "file", {
      optimizationLevel: 2
    });
    expect(compiled.globSet).toHaveLength(1);
    expect(compiled.globParts).toHaveLength(1);
    expect(compiled.globParts[0]).toHaveLength(count * 4 + 1);
    expect(compiled.set).toHaveLength(1);
  }
});
