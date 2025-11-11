import type { Entity } from "./types";
import type { MutationMethod } from "./types/MutationMethod";

/**
 * Creates a mutation method that wraps business logic with a bound dispatch function.
 *
 * Mutation methods are entity methods that can dispatch events to change entity state.
 * This helper function ensures the dispatch method is properly bound to the entity instance
 * and marks the method as a mutation so it can be excluded from {@link ReadonlyEntity} types.
 *
 * @template $$Entity - The entity type that extends Entity
 * @template $$Args - The tuple type of arguments the mutation function accepts
 * @template $$Return - The return type of the mutation function
 *
 * @param self - The entity instance that owns this mutation method
 * @param fn - The mutation implementation that receives a bound dispatch function followed by method arguments
 *
 * @returns A mutation method marked with `mutation: true` for type-level tracking
 *
 * @example
 * ```typescript
 * class User extends Entity(userSchema, userReducer) {
 *   // Define mutation methods using the mutation() helper
 *   updateProfile = mutation(this, (dispatch, bio: string) => {
 *     if (this.isDeleted) {
 *       throw new Error("Cannot update deleted user");
 *     }
 *     dispatch("user:profile_updated", { bio });
 *   });
 *
 *   delete = mutation(this, (dispatch, reason?: string) => {
 *     if (this.isDeleted) {
 *       throw new Error("User is already deleted");
 *     }
 *     dispatch("user:deleted", { reason });
 *   });
 * }
 *
 * // Usage
 * const user = User.create({ body: { nickname: "John", email: "john@example.com" } });
 * user.updateProfile("Software Engineer"); // Dispatches "user:profile_updated" event
 * user.delete("Account closure requested"); // Dispatches "user:deleted" event
 * ```
 *
 * @see {@link MutationMethod} - The return type that marks methods as mutations
 * @see {@link ReadonlyEntity} - Type that excludes mutation methods from loaded entities
 */
export function mutation<
  // biome-ignore lint/suspicious/noExplicitAny: extends any entity
  $$Entity extends Entity<any>,
  $$Args extends unknown[],
  $$Return,
>(
  self: $$Entity,
  fn: (dispatch: $$Entity[" $$dispatch"], ...args: $$Args) => $$Return,
): MutationMethod<(...args: $$Args) => $$Return> {
  const f: MutationMethod<(...args: $$Args) => $$Return> = (...args) => {
    return fn(self[" $$dispatch"].bind(self), ...args);
  };
  f.mutation = true;

  return f;
}
