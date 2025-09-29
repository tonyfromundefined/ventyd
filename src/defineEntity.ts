import type { $$DefinedDomainEvent } from "./defineDomainEvent";
import type { $$DefinedReducer } from "./defineReducer";
import type { $$DefinedState } from "./defineState";
import type { ZodEmptyObject } from "./ZodEmptyObject";
import type { $$ZodFrom } from "./ZodFrom";

export function defineEntity<
  EntityName extends string,
  DefinedDomainEvent extends $$DefinedDomainEvent<
    string,
    { [key: string]: ZodEmptyObject }
  >,
  DefinedState extends $$DefinedState<ZodEmptyObject>,
  DefinedReducer extends $$DefinedReducer<DefinedDomainEvent, DefinedState>,
>(options: {
  entityName: EntityName;
  definedDomainEvent: DefinedDomainEvent;
  definedState: DefinedState;
  definedReducer: DefinedReducer;
}) {
  return class BaseEntity {
    public entityName: EntityName;
    public entityId: string;

    public " $$state": $$ZodFrom<DefinedState>;
    public " $$reducer": $$DefinedReducer<DefinedDomainEvent, DefinedState>;

    constructor(args: {
      entityId?: string;
      initialState: $$ZodFrom<DefinedState>;
    }) {
      this.entityName = options.entityName;
      this.entityId = args.entityId ?? crypto.randomUUID();
      this[" $$state"] = args.initialState;
      this[" $$reducer"] = options.definedReducer;
    }
  };
}
