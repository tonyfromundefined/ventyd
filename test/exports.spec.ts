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

    // Adapter type is type-only export, no runtime check

    // Valibot re-export
    expect(mainExports.v).toBeDefined();
    expect(mainExports.v.object).toBeDefined();
    expect(mainExports.v.string).toBeDefined();
  });

  test("should export entity types", async () => {
    const entityTypes = await import("../src/entity-types/index");

    expect(entityTypes).toBeDefined();
    // The types themselves are compile-time only, but the module should load
  });

  test("should export schema types", async () => {
    const schemaTypes = await import("../src/schema-types/index");

    expect(schemaTypes).toBeDefined();
    // The types themselves are compile-time only, but the module should load
  });

  test("should export util types", async () => {
    const utilTypes = await import("../src/util-types/index");

    expect(utilTypes).toBeDefined();
    // The types themselves are compile-time only, but the module should load
  });

  test("should allow type imports", () => {
    // This test verifies that type imports work correctly
    // The actual types are checked at compile time
    type TestImports = {
      // From entity-types
      EntityConstructor: import("../src/entity-types").EntityConstructor<any>;
      EntityConstructorArgs: import("../src/entity-types").EntityConstructorArgs<any>;

      // From schema-types
      InferEntityNameFromSchema: import("../src/schema-types").InferEntityNameFromSchema<any>;
      InferStateFromSchema: import("../src/schema-types").InferStateFromSchema<any>;
      InferEventFromSchema: import("../src/schema-types").InferEventFromSchema<any>;

      // From util-types
      ValueOf: import("../src/util-types").ValueOf<any>;
      ConstructorReturnType: import("../src/util-types").ConstructorReturnType<any>;
    };

    // If this compiles, the type exports are working
    expect(true).toBe(true);
  });
});
