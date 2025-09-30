import { z } from "zod";
import type { Reducer } from "./defineReducer";
import type { BaseSchema } from "./defineSchema";

type InitialEventOf<Schema extends BaseSchema> = z.infer<
  Schema["eventMap"][Schema[" $$initialEventName"]]
>;

export interface $$IEntity<Schema extends BaseSchema> {
  // ----------------------
  // public properties
  // ----------------------
  entityName: Schema[" $$entityName"];
  entityId: string;
  get state(): z.infer<Schema["state"]>;

  // ----------------------
  // private properties
  // ----------------------
  " $$state": z.infer<Schema["state"]>;
  " $$schema": Schema;
  " $$queuedEvents": z.infer<Schema["event"]>[];
  " $$reducer": Reducer<Schema>;

  // ----------------------
  // public methods
  // ----------------------
  dispatch: <EventName extends z.infer<Schema["event"]>["eventName"]>(
    eventName: EventName,
    body: z.infer<Schema["eventMap"][EventName]>["body"],
  ) => void;

  // ----------------------
  // private methods
  // ----------------------
  " $$flush": () => void;
  " $$hydrate": (events: z.infer<Schema["event"]>[]) => void;
}

export function Entity<Schema extends BaseSchema>(
  schema: Schema,
  reducer: Reducer<Schema>,
) {
  return class $$Entity implements $$IEntity<Schema> {
    // ----------------------
    // public properties
    // ----------------------
    entityName: Schema[" $$entityName"] = schema[" $$entityName"];
    entityId: string;

    get state() {
      if (this[" $$state"] === null) {
        throw new Error("Entity is not initialized");
      }

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
    constructor(args?: {
      entityId?: string;
      body?: InitialEventOf<Schema>["body"];
    }) {
      // 0. prepare
      const entityName = schema[" $$entityName"];
      const initialEventName = schema[" $$initialEventName"];
      const initialEventBodySchema =
        schema[" $$eventBodyMap"][initialEventName];

      // 1. initialize entity
      const generateId = schema[" $$generateId"];
      this.entityId = args?.entityId ?? generateId();

      // 2. dispatch initial event
      if (args?.body) {
        if (!initialEventBodySchema) {
          throw new Error(
            `Body schema for initial event ${initialEventName} not found`,
          );
        }

        const eventName = `${entityName}:${initialEventName}` as const;
        const body = initialEventBodySchema.parse(args.body);

        this.dispatch(eventName, body);
      }
    }

    // ----------------------
    // public methods
    // ----------------------
    dispatch<EventName extends z.infer<Schema["event"]>["eventName"]>(
      eventName: EventName,
      body: z.infer<Schema["eventMap"][EventName]>["body"],
    ) {
      // 0. prepare
      type IEvent = z.infer<Schema["event"]>;
      const queuedEvents = this[" $$queuedEvents"];
      const reducer = this[" $$reducer"];
      const prevState = this[" $$state"];

      // 1. create event
      const event = {
        eventId: crypto.randomUUID(),
        eventName,
        eventCreatedAt: new Date().toISOString(),
        entityId: this.entityId,
        entityName: this.entityName,
        body,
      } as IEvent;

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

    " $$hydrate"(input: unknown[]) {
      // 0. prepare
      type IEvent = z.infer<Schema["event"]>;
      const reducer = this[" $$reducer"];
      const prevState = this[" $$state"];
      const EventArraySchema = z.array(this[" $$schema"].event);

      // 1. validate current state
      if (this[" $$state"] !== null) {
        throw new Error("Entity is already initialized");
      }

      // 2. validate events
      const events = EventArraySchema.parse(input) as IEvent[];

      // 3. compute state
      this[" $$state"] = events.reduce(reducer, prevState);
    }
  };
}
