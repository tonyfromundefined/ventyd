/**
 * @fileoverview TypeBox schema provider for Ventyd.
 * This module provides official integration between TypeBox validation library and Ventyd's event sourcing system.
 */

import { type Static, type TObject, Type } from "@sinclair/typebox";
import { Compile } from "@sinclair/typemap";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { standard } from "./standard";
import type { BaseEventType, SchemaInput, ValueOf } from "./types";

type TypeboxEmptyObject = TObject<{}>;

/**
 * Creates a TypeBox schema provider for Ventyd.
 *
 * This is the official TypeBox integration for Ventyd's event sourcing system.
 *
 * @typeParam $$EntityName - The entity name type (inferred from `defineSchema`)
 * @typeParam $$EventBodyTypeboxDefinition - Object mapping event names to TypeBox schemas
 * @typeParam $$StateTypeboxDefinition - TypeBox schema for entity state
 * @typeParam $$NamespaceSeparator - Separator between entity name and event name (default: ":")
 *
 * @param args - Schema definition
 * @param args.event - Map of event names to TypeBox object schemas defining event payloads
 * @param args.state - TypeBox object schema defining the entity state structure
 * @param args.namespaceSeparator - Optional separator between entity name and event name (default: ":")
 *
 * @returns A schema provider function compatible with Ventyd's `SchemaInput` interface
 *
 * @remarks
 * The `typebox()` provider bridges TypeBox's validation capabilities with Ventyd's event sourcing system.
 * It automatically adds entity metadata and namespacing to event schemas, providing type-safe parsing
 * for events and state through discriminated unions. TypeBox schemas are compiled using `@sinclair/typemap`
 * to provide Standard Schema compatibility.
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { defineSchema } from 'ventyd';
 * import { typebox, Type } from 'ventyd/typebox';
 *
 * const userSchema = defineSchema("user", {
 *   schema: typebox({
 *     event: {
 *       created: Type.Object({
 *         email: Type.String({ format: 'email' }),
 *         nickname: Type.String()
 *       }),
 *       profile_updated: Type.Object({
 *         nickname: Type.Optional(Type.String()),
 *         bio: Type.Optional(Type.String())
 *       }),
 *       deleted: Type.Object({
 *         reason: Type.Optional(Type.String())
 *       })
 *     },
 *     state: Type.Object({
 *       email: Type.String({ format: 'email' }),
 *       nickname: Type.String(),
 *       bio: Type.Optional(Type.String()),
 *       deletedAt: Type.Union([Type.Null(), Type.String()])
 *     })
 *   }),
 *   initialEventName: "user:created"
 * });
 * ```
 *
 * @example
 * Using TypeBox's format validation and constraints:
 * ```typescript
 * import { defineSchema } from 'ventyd';
 * import { typebox, Type } from 'ventyd/typebox';
 *
 * const userSchema = defineSchema("user", {
 *   schema: typebox({
 *     event: {
 *       created: Type.Object({
 *         email: Type.String({ format: 'email', maxLength: 255 }),
 *         age: Type.Number({ minimum: 13, maximum: 120 })
 *       })
 *     },
 *     state: Type.Object({
 *       email: Type.String(),
 *       age: Type.Number()
 *     })
 *   }),
 *   initialEventName: "user:created"
 * });
 * ```
 *
 * @see {@link defineSchema} for how to use this with entity schema definition
 * @see {@link SchemaInput} for the schema provider interface
 */
export function typebox<
  $$EntityName extends string,
  $$EventBodyTypeboxDefinition extends {
    [eventName: string]: TypeboxEmptyObject;
  },
  $$StateTypeboxDefinition extends TypeboxEmptyObject,
  $$NamespaceSeparator extends string = ":",
>(args: {
  event: $$EventBodyTypeboxDefinition;
  state: $$StateTypeboxDefinition;
  namespaceSeparator?: $$NamespaceSeparator;
}) {
  type $$EventStandardDefinition = {
    [key in Extract<
      keyof $$EventBodyTypeboxDefinition,
      string
    >]: StandardSchemaV1<
      unknown,
      BaseEventType & {
        eventName: `${$$EntityName}${$$NamespaceSeparator}${key}`;
        body: Static<$$EventBodyTypeboxDefinition[key]>;
      }
    >;
  };
  type $$EventType = StandardSchemaV1.InferOutput<
    ValueOf<$$EventStandardDefinition>
  >;

  type $$StateStandardDefinition = StandardSchemaV1<
    unknown,
    Static<$$StateTypeboxDefinition>
  >;
  type $$StateType = StandardSchemaV1.InferOutput<$$StateStandardDefinition>;

  type $$SchemaInput = SchemaInput<$$EntityName, $$EventType, $$StateType>;

  const input: $$SchemaInput = (context) => {
    const namespaceSeparator = args.namespaceSeparator ?? ":";

    const event = Object.entries(args.event).reduce((acc, [key, body]) => {
      const eventName = `${context.entityName}${namespaceSeparator}${key}`;
      const schema = Compile(
        Type.Object({
          eventId: Type.String(),
          eventCreatedAt: Type.String(),
          entityName: Type.String(),
          entityId: Type.String(),
          eventName: Type.Literal(eventName),
          body,
        }),
      );
      return {
        // biome-ignore lint/performance/noAccumulatingSpread: readonly acc
        ...acc,
        [eventName]: schema,
      };
    }, {} as $$EventStandardDefinition);

    const state = Compile(args.state);

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

export { Type } from "@sinclair/typebox";
