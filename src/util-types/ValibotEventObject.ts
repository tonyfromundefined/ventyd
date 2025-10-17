import type * as v from "valibot";
import type { ValibotEmptyObject } from "./ValibotEmptyObject";

export type ValibotEventObject<
  EventName extends string,
  ValibotEventBody extends ValibotEmptyObject,
> = v.ObjectSchema<
  {
    readonly eventId: v.StringSchema<undefined>;
    readonly eventName: v.LiteralSchema<EventName, undefined>;
    readonly eventCreatedAt: v.StringSchema<undefined>;
    readonly entityName: v.StringSchema<undefined>;
    readonly entityId: v.StringSchema<undefined>;
    readonly body: ValibotEventBody;
  },
  undefined
>;
