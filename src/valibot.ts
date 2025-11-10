/**
 * @fileoverview Valibot schema provider for Ventyd.
 * This module provides official integration between Valibot validation library and Ventyd's event sourcing system.
 */

import * as v from "valibot";
import type { SchemaInput, ValueOf } from "./types";

type ValibotEmptyObject = v.ObjectSchema<v.ObjectEntries, undefined>;

type ValibotBaseEventObject<
  EventName extends string,
  Body extends ValibotEmptyObject,
> = v.ObjectSchema<
  {
    eventId: v.StringSchema<undefined>;
    eventName: v.LiteralSchema<EventName, undefined>;
    eventCreatedAt: v.StringSchema<undefined>;
    entityName: v.StringSchema<undefined>;
    entityId: v.StringSchema<undefined>;
    body: Body;
  },
  undefined
>;

type ValibotEventObject<
  $$EntityName extends string,
  $$EventDefinition extends {
    [eventName: string]: ValibotEmptyObject;
  },
  $$NamespaceSeparator extends string,
> = ValueOf<{
  [key in keyof $$EventDefinition]: ValibotBaseEventObject<
    `${$$EntityName}${$$NamespaceSeparator}${Extract<key, string>}`,
    $$EventDefinition[key]
  >;
}>;

type ValibotCompleteEventObject<
  $$EntityName extends string,
  $$EventDefinition extends {
    [eventName: string]: ValibotEmptyObject;
  },
  $$NamespaceSeparator extends string,
> = v.VariantSchema<
  "eventName",
  ValibotEventObject<$$EntityName, $$EventDefinition, $$NamespaceSeparator>[],
  undefined
>;

type Tuple<T> = [T, ...T[]];

/**
 * Creates a Valibot schema provider for Ventyd.
 *
 * This is the official Valibot integration for Ventyd's event sourcing system.
 *
 * @typeParam $$EntityName - The entity name type (inferred from `defineSchema`)
 * @typeParam $$EventDefinition - Object mapping event names to Valibot schemas
 * @typeParam $$StateDefinition - Valibot schema for entity state
 * @typeParam $$NamespaceSeparator - Separator between entity name and event name (default: ":")
 *
 * @param args - Schema definition
 * @param args.event - Map of event names to Valibot object schemas defining event payloads
 * @param args.state - Valibot object schema defining the entity state structure
 *
 * @returns A schema provider function compatible with Ventyd's `SchemaInput` interface
 *
 * @remarks
 * The `valibot()` provider bridges Valibot's validation capabilities with Ventyd's event sourcing system.
 * It automatically:
 * - Adds entity and event metadata to each event schema
 * - Creates namespaced event names (e.g., "user:created")
 * - Provides type-safe parsing for events and state
 * - Supports discriminated unions for event validation
 *
 * ## Why Valibot?
 *
 * Valibot is the recommended validation library for Ventyd because:
 * 1. **Performance**: Fastest validation library with minimal overhead
 * 2. **Bundle Size**: Extremely lightweight with excellent tree-shaking
 * 3. **Type Safety**: Best-in-class TypeScript inference
 * 4. **Composability**: Pipe-based API for building complex validations
 *
 * ## Event Schema Structure
 *
 * Each event is automatically enriched with metadata:
 * - `eventId`: Unique event identifier
 * - `eventName`: Fully-qualified event name (e.g., "user:created")
 * - `eventCreatedAt`: ISO timestamp when the event was created
 * - `entityName`: The entity type this event belongs to
 * - `entityId`: The specific entity instance this event modifies
 * - `body`: Your custom event payload (defined in the schema)
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { defineSchema } from 'ventyd';
 * import { valibot, v } from 'ventyd/valibot';
 *
 * const userSchema = defineSchema("user", {
 *   schema: valibot({
 *     event: {
 *       created: v.object({
 *         email: v.pipe(v.string(), v.email()),
 *         nickname: v.string()
 *       }),
 *       profile_updated: v.object({
 *         nickname: v.optional(v.string()),
 *         bio: v.optional(v.string())
 *       }),
 *       deleted: v.object({
 *         reason: v.optional(v.string())
 *       })
 *     },
 *     state: v.object({
 *       email: v.pipe(v.string(), v.email()),
 *       nickname: v.string(),
 *       bio: v.optional(v.string()),
 *       deletedAt: v.nullable(v.optional(v.string()))
 *     })
 *   }),
 *   initialEventName: "user:created"
 * });
 * ```
 *
 * @example
 * Using advanced Valibot features:
 * ```typescript
 * import { defineSchema } from 'ventyd';
 * import { valibot, v } from 'ventyd/valibot';
 *
 * // Custom email validation
 * const EmailSchema = v.pipe(
 *   v.string(),
 *   v.email(),
 *   v.toLowerCase(),
 *   v.maxLength(255)
 * );
 *
 * // Reusable nickname validation
 * const NicknameSchema = v.pipe(
 *   v.string(),
 *   v.minLength(1),
 *   v.maxLength(50),
 *   v.regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric, underscore, and dash allowed")
 * );
 *
 * const userSchema = defineSchema("user", {
 *   schema: valibot({
 *     event: {
 *       created: v.object({
 *         email: EmailSchema,
 *         nickname: NicknameSchema,
 *         age: v.pipe(v.number(), v.minValue(13), v.maxValue(120))
 *       }),
 *       profile_updated: v.object({
 *         nickname: v.optional(NicknameSchema),
 *         bio: v.optional(v.pipe(v.string(), v.maxLength(500)))
 *       })
 *     },
 *     state: v.object({
 *       email: EmailSchema,
 *       nickname: NicknameSchema,
 *       age: v.number(),
 *       bio: v.optional(v.string())
 *     })
 *   }),
 *   initialEventName: "user:created"
 * });
 * ```
 *
 * @example
 * Complex state with nested objects:
 * ```typescript
 * import { defineSchema } from 'ventyd';
 * import { valibot, v } from 'ventyd/valibot';
 *
 * const orderSchema = defineSchema("order", {
 *   schema: valibot({
 *     event: {
 *       created: v.object({
 *         customerId: v.string(),
 *         items: v.array(v.object({
 *           productId: v.string(),
 *           quantity: v.pipe(v.number(), v.minValue(1)),
 *           price: v.pipe(v.number(), v.minValue(0))
 *         }))
 *       }),
 *       item_added: v.object({
 *         productId: v.string(),
 *         quantity: v.pipe(v.number(), v.minValue(1)),
 *         price: v.pipe(v.number(), v.minValue(0))
 *       })
 *     },
 *     state: v.object({
 *       customerId: v.string(),
 *       items: v.array(v.object({
 *         productId: v.string(),
 *         quantity: v.number(),
 *         price: v.number()
 *       })),
 *       totalAmount: v.number(),
 *       status: v.picklist(["draft", "confirmed", "shipped", "delivered"])
 *     })
 *   }),
 *   initialEventName: "order:created"
 * });
 * ```
 *
 * @see {@link defineSchema} for how to use this with entity schema definition
 * @see {@link SchemaInput} for the schema provider interface
 *
 * @since 1.0.0
 */
export function valibot<
  $$EntityName extends string,
  $$EventDefinition extends {
    [eventName: string]: ValibotEmptyObject;
  },
  $$StateDefinition extends ValibotEmptyObject,
  $$NamespaceSeparator extends string = ":",
>(args: {
  event: $$EventDefinition;
  state: $$StateDefinition;
}): SchemaInput<
  $$EntityName,
  Required<
    v.InferOutput<
      ValibotCompleteEventObject<
        $$EntityName,
        $$EventDefinition,
        $$NamespaceSeparator
      >
    >
  >,
  v.InferOutput<$$StateDefinition>,
  $$NamespaceSeparator
> {
  return (context) => {
    type $$EventObject = ValibotEventObject<
      $$EntityName,
      $$EventDefinition,
      $$NamespaceSeparator
    >;
    type $$EventObjectTuple = Tuple<$$EventObject>;

    type $$EventCompleteObject = ValibotCompleteEventObject<
      $$EntityName,
      $$EventDefinition,
      $$NamespaceSeparator
    >;

    type $$EventType = Required<v.InferOutput<$$EventCompleteObject>>;

    const baseEventSchema = v.object({
      eventId: v.string(),
      eventCreatedAt: v.string(),
      entityName: v.string(),
      entityId: v.string(),
    });

    const eventSchemaMap = new Map([
      ...Object.entries(args.event).map(([key, body]) => {
        const eventName = `${context.entityName}${context.namespaceSeparator}${key}`;
        const schema = v.object({
          ...baseEventSchema.entries,
          eventName: v.literal(eventName),
          body,
        });

        return [eventName, schema] as const;
      }),
    ]);

    const eventSchemaTuple = [...eventSchemaMap.values()] as $$EventObjectTuple;

    return {
      parseEvent(input) {
        return v.parse(
          v.variant("eventName", eventSchemaTuple),
          input,
        ) as $$EventType;
      },
      parseEventByName<K extends $$EventType["eventName"]>(
        eventName: K,
        input: unknown,
      ) {
        const schema = eventSchemaMap.get(eventName);

        if (!schema) {
          throw new Error(`Event name ${eventName} not found`);
        }

        return v.parse(schema, input) as Extract<$$EventType, { eventName: K }>;
      },
      parseState(input) {
        return v.parse(args.state, input);
      },
    };
  };
}

export * as v from "valibot";
