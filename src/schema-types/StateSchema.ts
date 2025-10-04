import type { StateDefinitionInput } from "./StateDefinitionInput";

// noop
export type StateSchema<StateDefinition extends StateDefinitionInput> =
  StateDefinition;
