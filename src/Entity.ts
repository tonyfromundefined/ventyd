import type z from "zod";
import type { $$Reducer } from "./defineReducer";
import type { $$BaseDefinedSchema } from "./defineSchema";

type $$InitialEvent<DefinedSchema extends $$BaseDefinedSchema> = z.infer<
  DefinedSchema["eventMap"][DefinedSchema[" $$initialEventName"]]
>;

export function Entity<
  EntityName extends string,
  DefinedSchema extends $$BaseDefinedSchema,
>(
  entityName: EntityName,
  schema: DefinedSchema,
  reducer: $$Reducer<DefinedSchema>,
) {
  return class BaseEntity {
    // ----------------------
    // public properties
    // ----------------------
    entityName: EntityName = entityName;
    entityId: string;

    get state() {
      return this[" $$state"];
    }

    // ----------------------
    // private properties
    // ----------------------
    // biome-ignore lint/suspicious/noExplicitAny: initial state is null
    " $$state": z.infer<DefinedSchema["state"]> = null as any;
    " $$schema": DefinedSchema = schema;
    " $$queuedEvents": z.infer<DefinedSchema["event"]>[] = [];
    " $$reducer": $$Reducer<DefinedSchema> = reducer;

    // ----------------------
    // constructor
    // ----------------------
    constructor(args: {
      entityId?: string;
      body: $$InitialEvent<DefinedSchema>["body"];
    }) {
      // 1. initialize entity
      this.entityId = args?.entityId ?? crypto.randomUUID();

      // 2. dispatch initial event
      const namespace = schema[" $$namespace"];
      const initialEventName = schema[" $$initialEventName"];
      this.dispatch(`${namespace}:${initialEventName}`, args.body);
    }

    // ----------------------
    // public methods
    // ----------------------
    dispatch<K extends z.infer<DefinedSchema["event"]>["eventName"]>(
      eventName: K,
      body: z.infer<DefinedSchema["eventMap"][K]>["body"],
    ) {
      type Event = z.infer<DefinedSchema["event"]>;

      // 1. create event
      const event: Event = {
        eventId: crypto.randomUUID(),
        eventName,
        eventCreatedAt: new Date().toISOString(),
        entityId: this.entityId,
        entityName,
        body,
      } as Event;

      const queuedEvents = this[" $$queuedEvents"];
      const reducer = this[" $$reducer"];
      const prevState = this[" $$state"];

      // 2. add event to queue
      queuedEvents.push(event);

      // 3. update state
      this[" $$state"] = reducer(prevState, event);
    }

    // ----------------------
    // private methods
    // ----------------------
    " $$flush"() {
      this[" $$queuedEvents"] = [];
    }
  };
}
