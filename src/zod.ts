/**
 * @fileoverview Zod schema provider for Ventyd.
 * This module provides official integration between Zod validation library and Ventyd's event sourcing system.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import { z } from "zod";
import { standard } from "./standard";
import type { BaseEventType, SchemaInput, ValueOf } from "./types";

type ZodEmptyObject = z.ZodObject<z.ZodRawShape>;

/**
 * Creates a Zod schema provider for Ventyd.
 *
 * This is the official Zod integration for Ventyd's event sourcing system.
 *
 * @typeParam $$EntityName - The entity name type (inferred from `defineSchema`)
 * @typeParam $$EventBodyZodDefinition - Object mapping event names to Zod schemas
 * @typeParam $$StateZodDefinition - Zod schema for entity state
 * @typeParam $$NamespaceSeparator - Separator between entity name and event name (default: ":")
 *
 * @param args - Schema definition
 * @param args.event - Map of event names to Zod object schemas defining event payloads
 * @param args.state - Zod object schema defining the entity state structure
 * @param args.namespaceSeparator - Optional separator between entity name and event name (default: ":")
 *
 * @returns A schema provider function compatible with Ventyd's `SchemaInput` interface
 *
 * @remarks
 * The `zod()` provider bridges Zod's validation capabilities with Ventyd's event sourcing system.
 * It automatically adds entity metadata and namespacing to event schemas, providing type-safe parsing
 * for events and state through discriminated unions. Zod natively implements Standard Schema V1
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { defineSchema } from 'ventyd';
 * import { zod, z } from 'ventyd/zod';
 *
 * const userSchema = defineSchema("user", {
 *   schema: zod({
 *     event: {
 *       created: z.object({
 *         email: z.string().email(),
 *         nickname: z.string()
 *       }),
 *       profile_updated: z.object({
 *         nickname: z.string().optional(),
 *         bio: z.string().optional()
 *       }),
 *       deleted: z.object({
 *         reason: z.string().optional()
 *       })
 *     },
 *     state: z.object({
 *       email: z.string().email(),
 *       nickname: z.string(),
 *       bio: z.string().optional(),
 *       deletedAt: z.string().nullable().optional()
 *     })
 *   }),
 *   initialEventName: "user:created"
 * });
 * ```
 *
 * @example
 * Using Zod's refinement and validation features:
 * ```typescript
 * import { defineSchema } from 'ventyd';
 * import { zod, z } from 'ventyd/zod';
 *
 * const userSchema = defineSchema("user", {
 *   schema: zod({
 *     event: {
 *       created: z.object({
 *         email: z.string().email().max(255),
 *         age: z.number().min(13).max(120)
 *       })
 *     },
 *     state: z.object({
 *       email: z.string(),
 *       age: z.number()
 *     })
 *   }),
 *   initialEventName: "user:created"
 * });
 * ```
 *
 * @see {@link defineSchema} for how to use this with entity schema definition
 * @see {@link SchemaInput} for the schema provider interface
 */
export function zod<
  $$EntityName extends string,
  $$EventBodyZodDefinition extends {
    [eventName: string]: ZodEmptyObject;
  },
  $$StateZodDefinition extends ZodEmptyObject,
  $$NamespaceSeparator extends string = ":",
>(args: {
  event: $$EventBodyZodDefinition;
  state: $$StateZodDefinition;
  namespaceSeparator?: $$NamespaceSeparator;
}) {
  type $$EventStandardDefinition = {
    [key in Extract<keyof $$EventBodyZodDefinition, string>]: StandardSchemaV1<
      unknown,
      BaseEventType & {
        eventName: `${$$EntityName}${$$NamespaceSeparator}${key}`;
        body: z.infer<$$EventBodyZodDefinition[key]>;
      }
    >;
  };
  type $$EventType = StandardSchemaV1.InferOutput<
    ValueOf<$$EventStandardDefinition>
  >;

  type $$StateStandardDefinition = StandardSchemaV1<
    unknown,
    z.infer<$$StateZodDefinition>
  >;
  type $$StateType = StandardSchemaV1.InferOutput<$$StateStandardDefinition>;

  type $$SchemaInput = SchemaInput<$$EntityName, $$EventType, $$StateType>;

  const input: $$SchemaInput = (context) => {
    const namespaceSeparator = args.namespaceSeparator ?? ":";

    const event = Object.entries(args.event).reduce((acc, [key, body]) => {
      const eventName = `${context.entityName}${namespaceSeparator}${key}`;

      // Zod natively implements Standard Schema V1
      const zodSchema = z.object({
        eventId: z.string(),
        eventCreatedAt: z.string(),
        entityName: z.string(),
        entityId: z.string(),
        eventName: z.literal(eventName),
        body,
      });

      // Zod schemas can be used directly as Standard Schema V1
      const standardSchema = zodSchema as unknown as StandardSchemaV1;

      return {
        // biome-ignore lint/performance/noAccumulatingSpread: readonly acc
        ...acc,
        [eventName]: standardSchema,
      };
    }, {} as $$EventStandardDefinition);

    // Zod state schema is already a Standard Schema V1
    const state = args.state as unknown as $$StateStandardDefinition;

    return standard<
      $$EntityName,
      $$EventStandardDefinition,
      $$StateStandardDefinition
    >({
      event,
      state,
    })(context);
  };

  return input;
}

export { z } from "zod";
