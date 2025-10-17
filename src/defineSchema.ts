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
 * @param options.event - Map of event names to Zod schemas defining event payloads
 * @param options.initialEventName - The event name that creates new entities
 * @param options.state - Zod schema defining the shape of entity state
 * @param options.generateId - Optional custom ID generator function
 *
 * @returns A fully-typed schema object for use with Entity and Repository
 *
 * @remarks
 * The schema is the foundation of your event-sourced domain model. It defines:
 * - **Events**: All possible events and their payload structures
 * - **State**: The shape of entity state
 * - **Identity**: How entity IDs are generated
 * - **Validation**: Automatic validation through Zod schemas
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
 * - **Optional Fields**: Use Zod's `.optional()` for nullable fields
 * - **Custom Types**: Create reusable Zod schemas for common patterns
 *
 * @example
 * ```typescript
 * import { defineSchema, z } from 'ventyd';
 *
 * const userSchema = defineSchema("user", {
 *   // Define all possible events and their payloads
 *   event: {
 *     created: z.object({
 *       email: z.string().email(),
 *       nickname: z.string().min(1).max(50),
 *       invitedBy: z.string().uuid().optional()
 *     }),
 *     profile_updated: z.object({
 *       nickname: z.string().min(1).max(50).optional(),
 *       bio: z.string().max(500).optional(),
 *       avatar: z.string().url().optional()
 *     }),
 *     verified: z.object({
 *       verifiedAt: z.string().datetime(),
 *       verificationMethod: z.enum(["email", "phone", "manual"])
 *     }),
 *     deleted: z.object({
 *       reason: z.string().optional(),
 *       deletedBy: z.string().uuid().optional()
 *     }),
 *     restored: z.object({
 *       restoredBy: z.string().uuid().optional()
 *     })
 *   },
 *
 *   // Specify which event creates new entities
 *   initialEventName: "created",
 *
 *   // Define the shape of entity state
 *   state: z.object({
 *     email: z.string().email(),
 *     nickname: z.string(),
 *     bio: z.string().nullable(),
 *     avatar: z.string().nullable(),
 *     isVerified: z.boolean(),
 *     isDeleted: z.boolean(),
 *     createdAt: z.string().datetime(),
 *     updatedAt: z.string().datetime(),
 *     verifiedAt: z.string().datetime().nullable(),
 *     deletedAt: z.string().datetime().nullable()
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
