import type { ZodEmptyObject } from "../util-types";

export interface EventDefinitionInput {
  [eventName: string]: ZodEmptyObject;
}
