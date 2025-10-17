import * as v from "valibot";
import type {
  EventDefinitionInput,
  Schema,
  SingleEventSchema,
  StateDefinitionInput,
} from "./schema-types";
import type { ValueOf } from "./util-types";

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
 *   generateId: () => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
 * });
 * ```
 *
 * @since 1.0.0
 */
export function defineSchema<
  $$EntityName extends string,
  $$EventDefinition extends EventDefinitionInput,
  $$StateDefinition extends StateDefinitionInput,
  $$InitialEventName extends Extract<keyof $$EventDefinition, string>,
>(
  entityName: $$EntityName,
  options: {
    event: $$EventDefinition;
    state: $$StateDefinition;
    initialEventName: $$InitialEventName;
    generateId?: () => string;
  },
): Schema<
  $$EntityName,
  $$EventDefinition,
  $$StateDefinition,
  $$InitialEventName
> {
  type $$SingleEventSchemaMap = {
    [eventName in keyof $$EventDefinition]: SingleEventSchema<
      `${$$EntityName}:${Extract<eventName, string>}`,
      $$EventDefinition[eventName]
    >;
  };
  type $$SingleEventSchemaTuple = [
    ValueOf<$$SingleEventSchemaMap>,
    ...ValueOf<$$SingleEventSchemaMap>[],
  ];

  const baseEventSchema = v.object({
    eventId: v.string(),
    eventCreatedAt: v.string(),
    entityName: v.string(),
    entityId: v.string(),
  });

  const eventSchemas = Object.entries(options.event).map(([eventName, body]) =>
    v.object({
      ...baseEventSchema.entries,
      eventName: v.literal(`${entityName}:${eventName}`),
      body,
    }),
  ) as $$SingleEventSchemaTuple;

  return {
    event: v.variant("eventName", eventSchemas),
    state: options.state,
    " $$entityName": entityName,
    " $$eventDefinition": options.event,
    " $$stateDefinition": options.state,
    " $$initialEventName": options.initialEventName,
    " $$initialEventBodySchema": options.event[options.initialEventName],
    " $$generateId": options.generateId ?? defaultGenerateId,
  };
}
