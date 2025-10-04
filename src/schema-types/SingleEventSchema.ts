import type { z } from "zod";
import type { ZodEmptyObject } from "../util-types";

export type SingleEventSchema<
  EventName extends string,
  Body extends ZodEmptyObject,
> = z.ZodObject<
  {
    eventId: z.ZodString;
    eventName: z.ZodLiteral<EventName>;
    eventCreatedAt: z.ZodString;
    entityName: z.ZodString;
    entityId: z.ZodString;
    body: Body;
  },
  z.core.$strip
>;

export type SingleEvent<
  EventName extends string,
  Body extends ZodEmptyObject,
> = z.infer<SingleEventSchema<EventName, Body>>;
