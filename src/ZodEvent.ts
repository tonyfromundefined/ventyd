import type { z } from "zod";
import type { ZodEmptyObject } from "./ZodEmptyObject";

export type ZodEvent<
  EventName extends string,
  ZodDomainEventBody extends ZodEmptyObject,
> = z.ZodObject<
  {
    eventId: z.ZodString;
    eventName: z.ZodLiteral<EventName>;
    eventCreatedAt: z.ZodString;
    entityName: z.ZodString;
    entityId: z.ZodString;
    body: ZodDomainEventBody;
  },
  z.core.$strip
>;
