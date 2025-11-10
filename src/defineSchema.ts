import type { Schema, SchemaInput } from "./schema-types";

const defaultGenerateId = () => crypto.randomUUID();

/**
 * Defines a complete schema for an event-sourced entity.
 *
 * @param entityName - The canonical name for this entity type (e.g., "user", "order")
 * @param options - Schema configuration options
 * @param options.event - Map of event names to Valibot schemas defining event payloads
 * @param options.initialEventName - The event name that creates new entities
 * @param options.state - Valibot schema defining the shape of entity state
 * @param options.generateId - Optional custom ID generator function
 * @param options.namespaceSeparator - Optional custom separator between entity name and event name (default: ":")
 *
 * @returns A fully-typed schema object for use with Entity and Repository
 *
 * @remarks
 * The schema is the foundation of your event-sourced domain model. It defines:
 * - **Events**: All possible events and their payload structures
 * - **State**: The shape of entity state
 * - **Identity**: How entity IDs are generated
 * - **Validation**: Automatic validation through Valibot schemas
 *
 * ## Architecture
 *
 * The schema serves as the single source of truth for:
 * 1. **Type Safety**: Full TypeScript inference throughout the system
 * 2. **Runtime Validation**: Automatic validation of events and state
 * 3. **Event Namespacing**: Events are prefixed with entity name (e.g., `user:created`)
 * 4. **Documentation**: Schema serves as living documentation of your domain
 *
 * ## Best Practices
 *
 * - **Event Naming**: Use past tense and snake_case for events (e.g., `created`, `updated`, `deleted`)
 * - **Event Granularity**: Prefer fine-grained events over coarse-grained ones
 * - **State Shape**: Keep state flat when possible for better performance
 * - **Optional Fields**: Use Valibot's `.optional()` for nullable fields
 * - **Custom Types**: Create reusable Valibot schemas for common patterns
 *
 * @example
 * ```typescript
 * import { defineSchema, v } from 'ventyd';
 *
 * const userSchema = defineSchema("user", {
 *   // Define all possible events and their payloads
 *   event: {
 *     created: v.object({
 *       email: v.pipe(v.string(), v.email()),
 *       nickname: v.pipe(v.string(), v.minLength(1), v.maxLength(50)),
 *       invitedBy: v.optional(v.pipe(v.string(), v.uuid()))
 *     }),
 *     profile_updated: v.object({
 *       nickname: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(50))),
 *       bio: v.optional(v.pipe(v.string(), v.maxLength(500))),
 *       avatar: v.optional(v.pipe(v.string(), v.url()))
 *     }),
 *     verified: v.object({
 *       verifiedAt: v.pipe(v.string(), v.isoDateTime()),
 *       verificationMethod: v.picklist(["email", "phone", "manual"])
 *     }),
 *     deleted: v.object({
 *       reason: v.optional(v.string()),
 *       deletedBy: v.optional(v.pipe(v.string(), v.uuid()))
 *     }),
 *     restored: v.object({
 *       restoredBy: v.optional(v.pipe(v.string(), v.uuid()))
 *     })
 *   },
 *
 *   // Specify which event creates new entities
 *   initialEventName: "created",
 *
 *   // Define the shape of entity state
 *   state: v.object({
 *     email: v.pipe(v.string(), v.email()),
 *     nickname: v.string(),
 *     bio: v.nullable(v.string()),
 *     avatar: v.nullable(v.string()),
 *     isVerified: v.boolean(),
 *     isDeleted: v.boolean(),
 *     createdAt: v.pipe(v.string(), v.isoDateTime()),
 *     updatedAt: v.pipe(v.string(), v.isoDateTime()),
 *     verifiedAt: v.nullable(v.pipe(v.string(), v.isoDateTime())),
 *     deletedAt: v.nullable(v.pipe(v.string(), v.isoDateTime()))
 *   }),
 *
 *   // Optional: Custom ID generator
 *   generateId: () => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
 *
 *   // Optional: Custom namespace separator (default is ":")
 *   // This will make event names like "user.created" instead of "user:created"
 *   namespaceSeparator: "."
 * });
 * ```
 *
 * @since 1.0.0
 */
export function defineSchema<
  $$EntityName extends string,
  $$EventType extends { eventName: string },
  $$StateType,
  $$InitialEventName extends $$EventType["eventName"],
  $$NamespaceSeparator extends string = ":",
>(
  entityName: $$EntityName,
  options: {
    definition: SchemaInput<
      $$EntityName,
      $$EventType,
      $$StateType,
      $$NamespaceSeparator
    >;
    initialEventName: $$InitialEventName;
    generateId?: () => string;
    namespaceSeparator?: $$NamespaceSeparator;
  },
): Schema<
  $$EntityName,
  $$EventType,
  $$StateType,
  $$InitialEventName,
  $$NamespaceSeparator
> {
  const namespaceSeparator =
    options.namespaceSeparator ?? (":" as $$NamespaceSeparator);
  const generateId = options.generateId ?? defaultGenerateId;

  const { parseEvent, parseEventByName, parseState } = options.definition({
    entityName,
    namespaceSeparator,
  });

  return {
    parseEvent,
    parseState,
    parseEventByName,
    " $$entityName": entityName,
    " $$initialEventName": options.initialEventName,
    " $$generateId": generateId,
    " $$namespaceSeparator": namespaceSeparator,
  };
}
