import type { z } from "zod";
import type { $$BaseDefinedSchema } from "./defineSchema";

export type $$Reducer<T extends $$BaseDefinedSchema> = (
  prevState: z.infer<T["state"]>,
  event: z.infer<T["event"]>,
) => z.infer<T["state"]>;

export function defineReducer<DefinedSchema extends $$BaseDefinedSchema>(
  schema: DefinedSchema,
  fn: $$Reducer<DefinedSchema>,
): $$Reducer<DefinedSchema> {
  return fn;
}
