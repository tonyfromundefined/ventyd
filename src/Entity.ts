import type z from "zod";
import type { Reducer } from "./defineReducer";
import type { BaseSchema } from "./defineSchema";

type InitialEventOf<Schema extends BaseSchema> = z.infer<
  Schema["eventMap"][Schema[" $$initialEventName"]]
>;

export function Entity<EntityName extends string, Schema extends BaseSchema>(
  entityName: EntityName,
  schema: Schema,
  reducer: Reducer<Schema>,
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
    " $$state": z.infer<Schema["state"]> = null as any;
    " $$schema": Schema = schema;
    " $$queuedEvents": z.infer<Schema["event"]>[] = [];
    " $$reducer": Reducer<Schema> = reducer;

    // ----------------------
    // constructor
    // ----------------------
    constructor(args: {
      entityId?: string;
      body: InitialEventOf<Schema>["body"];
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
    dispatch<EventName extends z.infer<Schema["event"]>["eventName"]>(
      eventName: EventName,
      body: z.infer<Schema["eventMap"][EventName]>["body"],
    ) {
      type Event = z.infer<Schema["event"]>;

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
