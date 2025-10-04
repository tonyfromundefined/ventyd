import type z from "zod";
import type { ValueOf } from "../util-types";
import type { EventDefinitionInput } from "./EventDefinitionInput";
import type { SingleEventSchema } from "./SingleEventSchema";

export type EventSchema<
  EntityName extends string,
  EventDefinition extends EventDefinitionInput,
> = z.ZodDiscriminatedUnion<
  ValueOf<{
    [key in keyof EventDefinition]: SingleEventSchema<
      `${EntityName}:${Extract<key, string>}`,
      EventDefinition[key]
    >;
  }>[],
  "eventName"
>;
