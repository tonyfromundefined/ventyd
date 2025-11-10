/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */
/** biome-ignore-all lint/correctness/noUnusedVariables: for testing */

import { describe, expect, test } from "vitest";

describe("Package Exports", () => {
  test("should export all public APIs from main index", async () => {
    const mainExports = await import("../src/index");

    // Core functions
    expect(mainExports.Entity).toBeDefined();
    expect(mainExports.createRepository).toBeDefined();
    expect(mainExports.defineReducer).toBeDefined();
    expect(mainExports.defineSchema).toBeDefined();

    // Storage Adapter type is type-only export, no runtime check
    // Schema providers (valibot, etc.) are exported separately
  });

  test("should export valibot schema provider separately", async () => {
    const valibot = await import("../src/valibot");
    expect(valibot.valibot).toBeDefined();
    expect(valibot.v).toBeDefined();
  });

  test("should export types", async () => {
    const types = await import("../src/types/index");

    expect(types).toBeDefined();
    // The types themselves are compile-time only, but the module should load
  });

  test("should allow type imports", () => {
    // This test verifies that type imports work correctly
    // The actual types are checked at compile time
    type TestImports = {
      // Entity types
      EntityConstructor: import("../src/types").EntityConstructor<any>;
      EntityConstructorArgs: import("../src/types").EntityConstructorArgs<any>;

      // Schema types
      InferEntityNameFromSchema: import("../src/types").InferEntityNameFromSchema<any>;
      InferStateFromSchema: import("../src/types").InferStateFromSchema<any>;
      InferEventFromSchema: import("../src/types").InferEventFromSchema<any>;

      // Util types
      ValueOf: import("../src/types").ValueOf<any>;
      ConstructorReturnType: import("../src/types").ConstructorReturnType<any>;
    };

    // If this compiles, the type exports are working
    expect(true).toBe(true);
  });
});
