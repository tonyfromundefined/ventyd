import type { Schema, SchemaInput } from "./types";
import type { BaseEventType } from "./types/BaseEventType";

const defaultGenerateId = () => crypto.randomUUID();

/**
 * Defines a complete schema for an event-sourced entity with pluggable validation.
 *
 * @param entityName - The canonical name for this entity type (e.g., "user", "order")
 * @param options - Schema configuration options
 * @param options.schema - Schema provider function (e.g., `valibot()`) that provides validation
 * @param options.initialEventName - The fully-qualified event name that creates new entities (e.g., "user:created")
 * @param options.generateId - Optional custom ID generator function (defaults to crypto.randomUUID)
 * @param options.namespaceSeparator - Optional custom separator between entity name and event name (default: ":")
 *
 * @returns A fully-typed schema object for use with Entity and Repository
 *
 * @remarks
 * The schema is the foundation of your event-sourced domain model, defining events,
 * state structure, identity, and validation through pluggable schema providers.
 *
 * Supports type-safe validation through Valibot (with Zod, Typebox, ArkType coming soon).
 * Events are automatically namespaced with entity name (e.g., `user:created`)
 *
 * @example
 * Using the Valibot provider:
 * ```typescript
 * import { defineSchema } from 'ventyd';
 * import { valibot, v } from 'ventyd/valibot';
 *
 * const userSchema = defineSchema("user", {
 *   schema: valibot({
 *     // Define all possible events and their payloads
 *     event: {
 *       created: v.object({
 *         email: v.pipe(v.string(), v.email()),
 *         nickname: v.pipe(v.string(), v.minLength(1), v.maxLength(50)),
 *         invitedBy: v.optional(v.pipe(v.string(), v.uuid()))
 *       }),
 *       profile_updated: v.object({
 *         nickname: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(50))),
 *         bio: v.optional(v.pipe(v.string(), v.maxLength(500))),
 *         avatar: v.optional(v.pipe(v.string(), v.url()))
 *       }),
 *       deleted: v.object({
 *         reason: v.optional(v.string()),
 *         deletedBy: v.optional(v.pipe(v.string(), v.uuid()))
 *       }),
 *       restored: v.object({
 *         restoredBy: v.optional(v.pipe(v.string(), v.uuid()))
 *       })
 *     },
 *     // Define the shape of entity state
 *     state: v.object({
 *       email: v.pipe(v.string(), v.email()),
 *       nickname: v.string(),
 *       bio: v.nullable(v.string()),
 *       avatar: v.nullable(v.string()),
 *       isVerified: v.boolean(),
 *       isDeleted: v.boolean(),
 *       deletedAt: v.nullable(v.pipe(v.string(), v.isoDateTime()))
 *     })
 *   }),
 *   // Specify which event creates new entities (use fully-qualified name)
 *   initialEventName: "user:created",
 *   // Optional: Custom ID generator
 *   generateId: () => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
 *   // Optional: Custom namespace separator (default is ":")
 *   namespaceSeparator: ":" // or ".", "/", etc.
 * });
 * ```
 *
 * @example
 * Using a custom separator:
 * ```typescript
 * import { defineSchema } from 'ventyd';
 * import { valibot, v } from 'ventyd/valibot';
 *
 * const productSchema = defineSchema("product", {
 *   schema: valibot({
 *     event: {
 *       created: v.object({ name: v.string(), price: v.number() }),
 *       updated: v.object({ price: v.number() })
 *     },
 *     state: v.object({ name: v.string(), price: v.number() })
 *   }),
 *   initialEventName: "product/created", // Note: use "/" separator
 *   namespaceSeparator: "/" // Events will be "product/created", "product/updated"
 * });
 * ```
 */
export function defineSchema<
  $$EntityName extends string,
  $$EventType extends BaseEventType,
  $$StateType,
  $$InitialEventName extends $$EventType["eventName"],
  $$NamespaceSeparator extends string = ":",
>(
  entityName: $$EntityName,
  options: {
    schema: SchemaInput<
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

  const { parseEvent, parseEventByName, parseState } = options.schema({
    entityName,
    namespaceSeparator,
  });

  return {
    parseEvent,
    parseEventByName,
    parseState,
    " $$entityName": entityName,
    " $$initialEventName": options.initialEventName,
    " $$generateId": generateId,
    " $$namespaceSeparator": namespaceSeparator,
  };
}
