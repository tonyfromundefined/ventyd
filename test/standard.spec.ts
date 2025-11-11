/** biome-ignore-all lint/style/noNonNullAssertion: for testing */
/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import * as v from "valibot";
import { describe, expect, test } from "vitest";
import { defineReducer, defineSchema, Entity } from "../src";
import { standard } from "../src/standard";

describe("Standard Schema Provider", () => {
  describe("Basic functionality", () => {
    test("should create schema with standard provider", () => {
      const schema = defineSchema("user", {
        schema: standard({
          event: {
            "user:created": v.object({
              eventId: v.string(),
              eventName: v.literal("user:created"),
              eventCreatedAt: v.string(),
              entityName: v.string(),
              entityId: v.string(),
              body: v.object({
                email: v.pipe(v.string(), v.email()),
                nickname: v.string(),
              }),
            }),
            "user:updated": v.object({
              eventId: v.string(),
              eventName: v.literal("user:updated"),
              eventCreatedAt: v.string(),
              entityName: v.string(),
              entityId: v.string(),
              body: v.object({
                nickname: v.optional(v.string()),
              }),
            }),
          },
          state: v.object({
            email: v.string(),
            nickname: v.string(),
          }),
        }),
        initialEventName: "user:created",
      });

      const reducer = defineReducer(schema, (prevState, event) => {
        switch (event.eventName) {
          case "user:created":
            return {
              email: event.body.email,
              nickname: event.body.nickname,
            };
          case "user:updated":
            return {
              ...prevState,
              nickname: event.body.nickname ?? prevState.nickname,
            };
          default: {
            return prevState;
          }
        }
      });

      const User = Entity(schema, reducer);
      const user = User.create({
        body: {
          email: "test@example.com",
          nickname: "TestUser",
        },
      });

      expect(user.entityName).toBe("user");
      expect(user.state.email).toBe("test@example.com");
      expect(user.state.nickname).toBe("TestUser");
    });

    test("should parse event by name", () => {
      const schema = defineSchema("user", {
        schema: standard({
          event: {
            "user:created": v.object({
              eventId: v.string(),
              eventName: v.literal("user:created"),
              eventCreatedAt: v.string(),
              entityName: v.string(),
              entityId: v.string(),
              body: v.object({
                email: v.pipe(v.string(), v.email()),
              }),
            }),
          },
          state: v.object({
            email: v.string(),
          }),
        }),
        initialEventName: "user:created",
      });

      const event = schema.parseEventByName("user:created", {
        eventId: "evt-123",
        eventName: "user:created",
        eventCreatedAt: new Date().toISOString(),
        entityName: "user",
        entityId: "usr-123",
        body: {
          email: "test@example.com",
        },
      });

      expect(event.eventName).toBe("user:created");
      expect(event.body.email).toBe("test@example.com");
    });

    test("should throw error for unknown event name", () => {
      const schema = defineSchema("user", {
        schema: standard({
          event: {
            "user:created": v.object({
              eventId: v.string(),
              eventName: v.literal("user:created"),
              eventCreatedAt: v.string(),
              entityName: v.string(),
              entityId: v.string(),
              body: v.object({
                email: v.string(),
              }),
            }),
          },
          state: v.object({
            email: v.string(),
          }),
        }),
        initialEventName: "user:created",
      });

      expect(() => {
        schema.parseEventByName("user:unknown" as any, {});
      }).toThrow('Event name "user:unknown" not found');
    });

    test("should parse state", () => {
      const schema = defineSchema("user", {
        schema: standard({
          event: {
            "user:created": v.object({
              eventId: v.string(),
              eventName: v.literal("user:created"),
              eventCreatedAt: v.string(),
              entityName: v.string(),
              entityId: v.string(),
              body: v.object({
                email: v.string(),
              }),
            }),
          },
          state: v.object({
            email: v.string(),
            nickname: v.string(),
          }),
        }),
        initialEventName: "user:created",
      });

      const state = schema.parseState({
        email: "test@example.com",
        nickname: "TestUser",
      });

      expect(state.email).toBe("test@example.com");
      expect(state.nickname).toBe("TestUser");
    });

    test("should throw error for invalid state", () => {
      const schema = defineSchema("user", {
        schema: standard({
          event: {
            "user:created": v.object({
              eventId: v.string(),
              eventName: v.literal("user:created"),
              eventCreatedAt: v.string(),
              entityName: v.string(),
              entityId: v.string(),
              body: v.object({
                email: v.string(),
              }),
            }),
          },
          state: v.object({
            email: v.string(),
            nickname: v.string(),
          }),
        }),
        initialEventName: "user:created",
      });

      expect(() => {
        schema.parseState({
          email: "test@example.com",
          // nickname is missing
        });
      }).toThrow("Validation failed");
    });
  });

  describe("parseEvent with multiple event types", () => {
    test("should parse correct event from union", () => {
      const schema = defineSchema("user", {
        schema: standard({
          event: {
            "user:created": v.object({
              eventId: v.string(),
              eventName: v.literal("user:created"),
              eventCreatedAt: v.string(),
              entityName: v.string(),
              entityId: v.string(),
              body: v.object({
                email: v.string(),
              }),
            }),
            "user:updated": v.object({
              eventId: v.string(),
              eventName: v.literal("user:updated"),
              eventCreatedAt: v.string(),
              entityName: v.string(),
              entityId: v.string(),
              body: v.object({
                nickname: v.string(),
              }),
            }),
          },
          state: v.object({
            email: v.string(),
            nickname: v.optional(v.string()),
          }),
        }),
        initialEventName: "user:created",
      });

      const createdEvent = schema.parseEvent({
        eventId: "evt-123",
        eventName: "user:created",
        eventCreatedAt: new Date().toISOString(),
        entityName: "user",
        entityId: "usr-123",
        body: {
          email: "test@example.com",
        },
      });

      expect(createdEvent.eventName).toBe("user:created");
      expect((createdEvent.body as { email: string }).email).toBe(
        "test@example.com",
      );

      const updatedEvent = schema.parseEvent({
        eventId: "evt-124",
        eventName: "user:updated",
        eventCreatedAt: new Date().toISOString(),
        entityName: "user",
        entityId: "usr-123",
        body: {
          nickname: "NewNickname",
        },
      });

      expect(updatedEvent.eventName).toBe("user:updated");
      expect((updatedEvent.body as { nickname: string }).nickname).toBe(
        "NewNickname",
      );
    });

    test("should throw error when no event schema matches", () => {
      const schema = defineSchema("user", {
        schema: standard({
          event: {
            "user:created": v.object({
              eventId: v.string(),
              eventName: v.literal("user:created"),
              eventCreatedAt: v.string(),
              entityName: v.string(),
              entityId: v.string(),
              body: v.object({
                email: v.string(),
              }),
            }),
          },
          state: v.object({
            email: v.string(),
          }),
        }),
        initialEventName: "user:created",
      });

      expect(() => {
        schema.parseEvent({
          eventId: "evt-123",
          eventName: "user:deleted", // Unknown event
          eventCreatedAt: new Date().toISOString(),
          entityName: "user",
          entityId: "usr-123",
          body: {},
        });
      }).toThrow("Validation failed");
    });
  });

  describe("Type inference", () => {
    test("should infer correct event types", () => {
      const schema = defineSchema("product", {
        schema: standard<
          "product",
          {
            "product:created": v.ObjectSchema<
              {
                eventId: v.StringSchema<undefined>;
                eventName: v.LiteralSchema<"product:created", undefined>;
                eventCreatedAt: v.StringSchema<undefined>;
                entityName: v.StringSchema<undefined>;
                entityId: v.StringSchema<undefined>;
                body: v.ObjectSchema<
                  {
                    name: v.StringSchema<undefined>;
                    price: v.NumberSchema<undefined>;
                  },
                  undefined
                >;
              },
              undefined
            >;
          },
          v.ObjectSchema<
            {
              name: v.StringSchema<undefined>;
              price: v.NumberSchema<undefined>;
            },
            undefined
          >
        >({
          event: {
            "product:created": v.object({
              eventId: v.string(),
              eventName: v.literal("product:created"),
              eventCreatedAt: v.string(),
              entityName: v.string(),
              entityId: v.string(),
              body: v.object({
                name: v.string(),
                price: v.number(),
              }),
            }),
          },
          state: v.object({
            name: v.string(),
            price: v.number(),
          }),
        }),
        initialEventName: "product:created",
      });

      const reducer = defineReducer(schema, (prevState, event) => {
        switch (event.eventName) {
          case "product:created":
            return {
              name: event.body.name,
              price: event.body.price,
            };
          default: {
            return prevState;
          }
        }
      });

      const Product = Entity(schema, reducer);
      const product = Product.create({
        body: {
          name: "Test Product",
          price: 99.99,
        },
      });

      expect(product.state.name).toBe("Test Product");
      expect(product.state.price).toBe(99.99);
    });
  });
});
