import type { ZodEmptyObject } from "./ZodEmptyObject";

export type $$DefinedState<S extends ZodEmptyObject> = {
  " $$typeof": "DefinedState";
  " $$schema": S;
};

export function defineState<S extends ZodEmptyObject>(options: {
  schema: S;
}): $$DefinedState<S> {
  return {
    " $$typeof": "DefinedState",
    " $$schema": options.schema,
  };
}
