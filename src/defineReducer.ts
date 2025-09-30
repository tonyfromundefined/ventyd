import type { z } from "zod";
import type { $$DefinedSchema, $$EventSchemaMap } from "./defineSchema";
import type { ValueOf } from "./ValueOf";
import type { ZodEmptyObject } from "./ZodEmptyObject";

export type $$Reducer<T> = T extends $$DefinedSchema<
  infer Namespace,
  infer EventBodySchemaMap,
  string,
  infer State
>
  ? (
      prevState: z.infer<State>,
      event: z.infer<
        z.ZodDiscriminatedUnion<
          ValueOf<$$EventSchemaMap<Namespace, EventBodySchemaMap>>[],
          "eventName"
        >
      >,
    ) => z.infer<State>
  : never;

export function defineReducer<
  DefinedSchema extends $$DefinedSchema<
    string,
    { [key: string]: ZodEmptyObject },
    string,
    ZodEmptyObject
  >,
>(
  schema: DefinedSchema,
  fn: $$Reducer<DefinedSchema>,
): $$Reducer<DefinedSchema> {
  return fn;
}
