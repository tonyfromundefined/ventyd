import type * as v from "valibot";
import type { ValibotEmptyObject } from "../util-types";

export type SingleEventSchema<
  EventName extends string,
  Body extends ValibotEmptyObject,
> = v.ObjectSchema<
  {
    eventId: v.StringSchema<undefined>;
    eventName: v.LiteralSchema<EventName, undefined>;
    eventCreatedAt: v.StringSchema<undefined>;
    entityName: v.StringSchema<undefined>;
    entityId: v.StringSchema<undefined>;
    body: Body;
  },
  undefined
>;

export type SingleEvent<
  EventName extends string,
  Body extends ValibotEmptyObject,
> = v.InferOutput<SingleEventSchema<EventName, Body>>;
