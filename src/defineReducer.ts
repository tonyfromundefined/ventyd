import type { z } from "zod";
import type { BaseSchema } from "./defineSchema";

export type Reducer<Schema extends BaseSchema> = (
  prevState: z.infer<Schema["state"]>,
  event: z.infer<Schema["event"]>,
) => z.infer<Schema["state"]>;

export function defineReducer<Schema extends BaseSchema>(
  schema: Schema,
  fn: Reducer<Schema>,
): Reducer<Schema> {
  return fn;
}
