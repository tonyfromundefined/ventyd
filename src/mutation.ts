import type { Entity } from "./types";
import type { MutationMethod } from "./types/MutationMethod";

export function mutation<
  // biome-ignore lint/suspicious/noExplicitAny: extends any entity
  $$Entity extends Entity<any>,
  $$Args extends unknown[],
  $$Return,
>(
  self: $$Entity,
  fn: (dispatch: $$Entity[" $$dispatch"], ...args: $$Args) => $$Return,
): MutationMethod<(...args: $$Args) => $$Return> {
  const f: MutationMethod<(...args: $$Args) => $$Return> = (...args) => {
    return fn(self[" $$dispatch"], ...args);
  };
  f.mutation = true;

  return f;
}
