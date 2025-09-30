import type { z } from "zod";
import type { ZodEmptyObject } from "./ZodEmptyObject";

export type ZodEventObject<
  EventName extends string,
  ZodEventBody extends ZodEmptyObject,
> = z.ZodObject<
  {
    eventId: z.ZodString;
    eventName: z.ZodLiteral<EventName>;
    eventCreatedAt: z.ZodString;
    entityName: z.ZodString;
    entityId: z.ZodString;
    body: ZodEventBody;
  },
  z.core.$strip
>;
