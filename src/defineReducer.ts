import type { Reducer } from "./types";

/**
 * Defines a reducer function for computing entity state from events.
 *
 * @param schema - The entity schema created with `defineSchema()`
 * @param fn - The reducer implementation
 * @returns A type-safe reducer function
 *
 * @remarks
 * The reducer is the heart of your event sourcing implementation. It defines
 * the business logic for how events affect entity state. Every state transition
 * in your domain is explicitly modeled through the reducer.
 *
 * @example
 * ```typescript
 * import { defineReducer, defineSchema } from 'ventyd';
 *
 * const userReducer = defineReducer(userSchema, (prevState, event) => {
 *   // Handle initial state (`prevState` is null)
 *   if (event.eventName === "user:created") {
 *     return {
 *       email: event.body.email,
 *       nickname: event.body.nickname,
 *       bio: null,
 *       isDeleted: false,
 *       createdAt: event.eventCreatedAt
 *     };
 *   }
 *
 *   // Handle state transitions
 *   switch (event.eventName) {
 *     case "user:profile_updated":
 *       return {
 *         ...prevState,
 *         nickname: event.body.nickname ?? prevState.nickname,
 *         bio: event.body.bio ?? prevState.bio
 *       };
 *
 *     case "user:deleted":
 *       return {
 *         ...prevState,
 *         isDeleted: true,
 *         deletedAt: event.eventCreatedAt
 *       };
 *
 *     case "user:restored":
 *       return {
 *         ...prevState,
 *         isDeleted: false,
 *         deletedAt: undefined
 *       };
 *
 *     // Handle unknown events
 *     default:
 *       return prevState;
 *   }
 * });
 * ```
 *
 * ## Advanced Patterns
 *
 * ### Computed Properties
 * ```typescript
 * case "order:item_added":
 *   const newItems = [...prevState.items, event.body];
 *   return {
 *     ...prevState,
 *     items: newItems,
 *     totalAmount: newItems.reduce((sum, item) =>
 *       sum + (item.price * item.quantity), 0
 *     )
 *   };
 * ```
 *
 * ### Event Versioning
 * ```typescript
 * case "user:profile_updated":
 * case "user:profile_updated:v2":
 *   // Handle multiple versions of the same event
 *   return handleProfileUpdate(prevState, event);
 * ```
 *
 * ### State Validation
 * ```typescript
 * const newState = computeNewState(prevState, event);
 *
 * // Validate business invariants
 * if (newState.balance < 0) {
 *   console.warn("Invalid state: negative balance");
 *   return prevState; // Reject invalid transition
 * }
 *
 * return newState;
 * ```
 *
 * @since 1.0.0
 */
export function defineReducer<$$Schema>(
  schema: $$Schema,
  fn: Reducer<$$Schema>,
): Reducer<$$Schema> {
  return fn;
}
