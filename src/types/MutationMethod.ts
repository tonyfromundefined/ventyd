/**
 * Marks a method as a mutation method by adding a `mutation: true` property.
 *
 * This marker is used by the {@link ReadonlyEntity} type to identify and exclude
 * mutation methods from loaded entities, ensuring that entities loaded from existing
 * state cannot dispatch new events.
 *
 * @template T - The method type to mark as a mutation
 *
 * @example
 * ```typescript
 * // Created by the mutation() helper
 * type UpdateMethod = MutationMethod<(bio: string) => void>;
 * // Results in: ((bio: string) => void) & { mutation: true }
 * ```
 *
 * @see {@link mutation} - Helper function that creates mutation methods
 * @see {@link ReadonlyEntity} - Type that excludes mutation methods
 */
export type MutationMethod<T> = T & { mutation: true };
