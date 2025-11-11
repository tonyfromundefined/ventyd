/**
 * @fileoverview Valibot schema provider for Ventyd.
 * This module provides official integration between Valibot validation library and Ventyd's event sourcing system.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as v from "valibot";
import { standard } from "./standard";
import type { BaseEventType, SchemaInput, ValueOf } from "./types";

type ValibotEmptyObject = v.ObjectSchema<v.ObjectEntries, undefined>;

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
 * @param args.namespaceSeparator - Optional separator between entity name and event name (default: ":")
 *
 * @returns A schema provider function compatible with Ventyd's `SchemaInput` interface
 *
 * @remarks
 * The `valibot()` provider bridges Valibot's validation capabilities with Ventyd's event sourcing system.
 * It automatically adds entity metadata and namespacing to event schemas, providing type-safe parsing
 * for events and state through discriminated unions
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
 * Using Valibot's pipe and validation features:
 * ```typescript
 * import { defineSchema } from 'ventyd';
 * import { valibot, v } from 'ventyd/valibot';
 *
 * const userSchema = defineSchema("user", {
 *   schema: valibot({
 *     event: {
 *       created: v.object({
 *         email: v.pipe(v.string(), v.email(), v.maxLength(255)),
 *         age: v.pipe(v.number(), v.minValue(13), v.maxValue(120))
 *       })
 *     },
 *     state: v.object({
 *       email: v.string(),
 *       age: v.number()
 *     })
 *   }),
 *   initialEventName: "user:created"
 * });
 * ```
 *
 * @see {@link defineSchema} for how to use this with entity schema definition
 * @see {@link SchemaInput} for the schema provider interface
 */
export function valibot<
  $$EntityName extends string,
  $$EventBodyValibotDefinition extends {
    [eventName: string]: ValibotEmptyObject;
  },
  $$StateValibotDefinition extends ValibotEmptyObject,
  $$NamespaceSeparator extends string = ":",
>(args: {
  event: $$EventBodyValibotDefinition;
  state: $$StateValibotDefinition;
  namespaceSeparator?: $$NamespaceSeparator;
}) {
  type $$EventStandardDefinition = {
    [key in Extract<
      keyof $$EventBodyValibotDefinition,
      string
    >]: StandardSchemaV1<
      unknown,
      BaseEventType & {
        eventName: `${$$EntityName}${$$NamespaceSeparator}${key}`;
        body: v.InferOutput<$$EventBodyValibotDefinition[key]>;
      }
    >;
  };
  type $$EventType = StandardSchemaV1.InferOutput<
    ValueOf<$$EventStandardDefinition>
  >;

  type $$StateStandardDefinition = StandardSchemaV1<
    unknown,
    v.InferOutput<$$StateValibotDefinition>
  >;
  type $$StateType = StandardSchemaV1.InferOutput<$$StateStandardDefinition>;

  type $$SchemaInput = SchemaInput<$$EntityName, $$EventType, $$StateType>;

  const input: $$SchemaInput = (context) => {
    const namespaceSeparator = args.namespaceSeparator ?? ":";

    const baseEventSchema = v.object({
      eventId: v.string(),
      eventCreatedAt: v.string(),
      entityName: v.string(),
      entityId: v.string(),
    });

    const event = Object.entries(args.event).reduce((acc, [key, body]) => {
      const eventName = `${context.entityName}${namespaceSeparator}${key}`;
      const schema = v.object({
        ...baseEventSchema.entries,
        eventName: v.literal(eventName),
        body,
      });
      return {
        // biome-ignore lint/performance/noAccumulatingSpread: readonly acc
        ...acc,
        [eventName]: schema,
      };
    }, {} as $$EventStandardDefinition);

    const state = args.state;

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

export * as v from "valibot";
