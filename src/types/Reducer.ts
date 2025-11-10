import type { InferEventFromSchema, InferStateFromSchema } from "./Schema";

/**
 * Reducer function signature for computing entity state from events.
 *
 * @param prevState - The previous state of the entity (null for initial state)
 * @param event - The event to apply to the state
 * @returns The new state after applying the event
 *
 * @remarks
 * Reducers are pure functions that deterministically compute the next state
 * given the previous state and an event. They form the core of the event
 * sourcing pattern by defining how events transform entity state.
 *
 * @since 1.0.0
 */
export type Reducer<$$Schema> = (
  prevState: InferStateFromSchema<$$Schema>,
  event: InferEventFromSchema<$$Schema> | { eventName: "%unknown%" },
) => InferStateFromSchema<$$Schema>;
