import type { MutationMethod } from "./MutationMethod";

/**
 * Represents a read-only version of an entity where all mutation methods are excluded.
 *
 * This type is used to enforce immutability for entities that are loaded from existing state
 * (via `Entity.load()`). Since these entities don't have the full event history, they cannot
 * safely dispatch new events, so all mutation methods are stripped from the type.
 *
 * @template $$Entity - The entity type to make readonly
 *
 * @example
 * ```typescript
 * class User extends Entity(userSchema, userReducer) {
 *   updateProfile = mutation(this, (dispatch, bio: string) => {
 *     dispatch("user:profile_updated", { bio });
 *   });
 * }
 *
 * // Created entities have full mutation access
 * const user = User.create({ body: { nickname: "John", email: "john@example.com" } });
 * user.updateProfile("Software Engineer"); // ✅ Works
 *
 * // Loaded entities are readonly - mutations are excluded from the type
 * const loadedUser = User.load({
 *   entityId: "user-123",
 *   state: { nickname: "John", email: "john@example.com" }
 * });
 * // loadedUser.updateProfile("..."); // ❌ Type error: Property 'updateProfile' does not exist
 * ```
 */
export type ReadonlyEntity<$$Entity> = {
  [key in keyof $$Entity]: $$Entity[key] extends MutationMethod<unknown>
    ? never
    : $$Entity[key];
};
