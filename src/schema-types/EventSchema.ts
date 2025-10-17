import type * as v from "valibot";
import type { ValueOf } from "../util-types";
import type { EventDefinitionInput } from "./EventDefinitionInput";
import type { SingleEventSchema } from "./SingleEventSchema";

export type EventSchema<
  EntityName extends string,
  EventDefinition extends EventDefinitionInput,
> = v.VariantSchema<
  "eventName",
  ValueOf<{
    [key in keyof EventDefinition]: SingleEventSchema<
      `${EntityName}:${Extract<key, string>}`,
      EventDefinition[key]
    >;
  }>[],
  undefined
>;
