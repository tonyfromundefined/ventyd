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
      const entityName = schema[" $$entityName"];
      const initialEventName = schema[" $$initialEventName"];
      const initialEventBodySchema =
        schema[" $$eventBodyMap"][initialEventName];
      type InitialEventBody = InitialEventOf<Schema>["body"];

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

        this.dispatch(
          `${entityName}:${initialEventName}`,
          initialEventBodySchema.parse(args.body) as InitialEventBody,
        );
      }
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
        entityName: this.entityName,
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

    " $$hydrate"(input: unknown[]) {
      if (this[" $$state"] !== null) {
        throw new Error("Entity is already initialized");
      }

      const reducer = this[" $$reducer"];
      const prevState = this[" $$state"];

      // 1. validate events
      const EventArray = z.array(this[" $$schema"].event);
      const events = EventArray.parse(input) as z.infer<Schema["event"]>[];

      // 2. compute state
      this[" $$state"] = events.reduce(reducer, prevState);
    }
  };
}
