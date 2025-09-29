import type { $$DefinedDomainEvent } from "./defineDomainEvent";
import type { $$DefinedState } from "./defineState";
import type { ZodEmptyObject } from "./ZodEmptyObject";
import type { $$ZodFrom } from "./ZodFrom";

type $$ReducerFn<
  DefinedDomainEvent extends $$DefinedDomainEvent<
    string,
    { [key: string]: ZodEmptyObject }
  >,
  DefinedState extends $$DefinedState<ZodEmptyObject>,
> = (
  prevState: $$ZodFrom<DefinedState>,
  event: $$ZodFrom<DefinedDomainEvent>,
) => $$ZodFrom<DefinedState>;

export type $$DefinedReducer<
  DefinedDomainEvent extends $$DefinedDomainEvent<
    string,
    { [key: string]: ZodEmptyObject }
  >,
  DefinedState extends $$DefinedState<ZodEmptyObject>,
> = $$ReducerFn<DefinedDomainEvent, DefinedState> & {
  " $$typeof": "DefinedReducer";
};

export function defineReducer<
  Namespace extends string,
  DefinedDomainEvent extends $$DefinedDomainEvent<
    Namespace,
    { [key: string]: ZodEmptyObject }
  >,
  DefinedState extends $$DefinedState<ZodEmptyObject>,
>(options: {
  definedDomainEvent: DefinedDomainEvent;
  definedState: DefinedState;
  reducer: $$ReducerFn<DefinedDomainEvent, DefinedState>;
}): $$DefinedReducer<DefinedDomainEvent, DefinedState> {
  const r = options.reducer as $$DefinedReducer<
    DefinedDomainEvent,
    DefinedState
  >;
  r[" $$typeof"] = "DefinedReducer";
  return r;
}
