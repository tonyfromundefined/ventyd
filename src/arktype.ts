/**
 * @fileoverview ArkType schema provider for Ventyd.
 * This module provides official integration between ArkType validation library and Ventyd's event sourcing system.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import { type Type, type } from "arktype";
import { standard } from "./standard";
import type { BaseEventType, SchemaInput, ValueOf } from "./types";

type ArktypeObjectType = Type<object, object>;

/**
 * Creates an ArkType schema provider for Ventyd.
 *
 * This is the official ArkType integration for Ventyd's event sourcing system.
 *
 * @typeParam $$EntityName - The entity name type (inferred from `defineSchema`)
 * @typeParam $$EventBodyArktypeDefinition - Object mapping event names to ArkType schemas
 * @typeParam $$StateArktypeDefinition - ArkType schema for entity state
 * @typeParam $$NamespaceSeparator - Separator between entity name and event name (default: ":")
 *
 * @param args - Schema definition
 * @param args.event - Map of event names to ArkType object schemas defining event payloads
 * @param args.state - ArkType object schema defining the entity state structure
 * @param args.namespaceSeparator - Optional separator between entity name and event name (default: ":")
 *
 * @returns A schema provider function compatible with Ventyd's `SchemaInput` interface
 *
 * @remarks
 * The `arktype()` provider bridges ArkType's validation capabilities with Ventyd's event sourcing system.
 * It automatically adds entity metadata and namespacing to event schemas, providing type-safe parsing
 * for events and state through discriminated unions. ArkType natively implements Standard Schema V1.
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { defineSchema } from 'ventyd';
 * import { arktype, type } from 'ventyd/arktype';
 *
 * const userSchema = defineSchema("user", {
 *   schema: arktype({
 *     event: {
 *       created: type({
 *         email: "string.email",
 *         nickname: "string"
 *       }),
 *       profile_updated: type({
 *         "nickname?": "string",
 *         "bio?": "string"
 *       }),
 *       deleted: type({
 *         "reason?": "string"
 *       })
 *     },
 *     state: type({
 *       email: "string.email",
 *       nickname: "string",
 *       "bio?": "string",
 *       "deletedAt?": "string | null"
 *     })
 *   }),
 *   initialEventName: "user:created"
 * });
 * ```
 *
 * @example
 * Using ArkType's validation constraints:
 * ```typescript
 * import { defineSchema } from 'ventyd';
 * import { arktype, type } from 'ventyd/arktype';
 *
 * const userSchema = defineSchema("user", {
 *   schema: arktype({
 *     event: {
 *       created: type({
 *         email: "string.email",
 *         age: "number >= 13 <= 120"
 *       })
 *     },
 *     state: type({
 *       email: "string",
 *       age: "number"
 *     })
 *   }),
 *   initialEventName: "user:created"
 * });
 * ```
 *
 * @see {@link defineSchema} for how to use this with entity schema definition
 * @see {@link SchemaInput} for the schema provider interface
 */
export function arktype<
  $$EntityName extends string,
  $$EventBodyArktypeDefinition extends {
    [eventName: string]: ArktypeObjectType;
  },
  $$StateArktypeDefinition extends ArktypeObjectType,
  $$NamespaceSeparator extends string = ":",
>(args: {
  event: $$EventBodyArktypeDefinition;
  state: $$StateArktypeDefinition;
  namespaceSeparator?: $$NamespaceSeparator;
}) {
  type $$EventStandardDefinition = {
    [key in Extract<
      keyof $$EventBodyArktypeDefinition,
      string
    >]: StandardSchemaV1<
      unknown,
      BaseEventType & {
        eventName: `${$$EntityName}${$$NamespaceSeparator}${key}`;
        body: $$EventBodyArktypeDefinition[key]["infer"];
      }
    >;
  };
  type $$EventType = StandardSchemaV1.InferOutput<
    ValueOf<$$EventStandardDefinition>
  >;

  type $$StateStandardDefinition = StandardSchemaV1<
    unknown,
    $$StateArktypeDefinition["infer"]
  >;
  type $$StateType = StandardSchemaV1.InferOutput<$$StateStandardDefinition>;

  type $$SchemaInput = SchemaInput<$$EntityName, $$EventType, $$StateType>;

  const input: $$SchemaInput = (context) => {
    const namespaceSeparator = args.namespaceSeparator ?? ":";

    const event = Object.entries(args.event).reduce((acc, [key, body]) => {
      const eventName = `${context.entityName}${namespaceSeparator}${key}`;

      // ArkType's intersection to combine base event and body
      const arktypeSchema = type({
        eventId: "string",
        eventCreatedAt: "string",
        entityName: "string",
        entityId: "string",
        eventName: `'${eventName}'`,
        body,
      });

      // ArkType natively implements Standard Schema V1
      // We can use it directly as a StandardSchemaV1
      const standardSchema = arktypeSchema as unknown as StandardSchemaV1;

      return {
        // biome-ignore lint/performance/noAccumulatingSpread: readonly acc
        ...acc,
        [eventName]: standardSchema,
      };
    }, {} as $$EventStandardDefinition);

    // ArkType state schema is already a Standard Schema V1
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

export { type } from "arktype";
