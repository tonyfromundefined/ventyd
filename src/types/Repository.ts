/**
 * Repository interface providing persistence operations for entities.
 *
 * @typeParam Entity - The entity type managed by this repository
 *
 * @remarks
 * The Repository pattern abstracts storage concerns from domain logic,
 * providing a clean interface for entity persistence and retrieval.
 * All operations are asynchronous to support various storage backends.
 */
export type Repository<$$Entity> = {
  /**
   * Retrieves an entity by its unique identifier.
   *
   * @param args - Query parameters
   * @param args.entityId - The unique identifier of the entity to retrieve
   * @returns A promise resolving to the entity if found, null otherwise
   *
   * @remarks
   * This method reconstructs the entity's current state by replaying all
   * historical events from storage. The reconstruction process is deterministic,
   * ensuring the same sequence of events always produces the same state.
   *
   * @example
   * ```typescript
   * const user = await userRepository.findOne({
   *   entityId: "user-123"
   * });
   * ```
   */
  findOne: (args: { entityId: string }) => Promise<$$Entity | null>;

  /**
   * Persists an entity's pending events to storage.
   *
   * @param entity - The entity instance with queued events to persist
   * @returns A promise that resolves when persistence is complete
   *
   * @remarks
   * The commit operation performs several critical steps:
   * 1. Extracts all queued events from the entity
   * 2. Persists events atomically to the configured storage backend
   * 3. Clears the entity's event queue
   *
   * Events are only persisted if the commit succeeds. In case of failure,
   * the entity's event queue remains intact for retry.
   *
   * @example
   * ```typescript
   * const user = new User({
   *   body: { email: "user@example.com", nickname: "John" }
   * });
   *
   * user.updateProfile({ bio: "Developer" });
   * user.verify({ verifiedAt: new Date().toISOString() });
   *
   * // Persist both events in a single transaction
   * await userRepository.commit(user);
   * ```
   *
   * @throws Will propagate any errors from the storage layer
   */
  commit: (entity: $$Entity) => Promise<void>;
};
