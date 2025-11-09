/** biome-ignore-all lint/style/noNonNullAssertion: for testing */
/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import * as v from "valibot";
import { describe, expect, test } from "vitest";
import { defineReducer } from "../src/defineReducer";
import { defineSchema } from "../src/defineSchema";
import { Entity } from "../src/Entity";
import { Order } from "./entities/Order";
import { User } from "./entities/User";

describe("Entity Unit Tests", () => {
  describe("Entity Initialization", () => {
    test("should create entity with initial event", () => {
      const user = User.create({
        body: {
          nickname: "TestUser",
          email: "test@example.com",
        },
      });

      expect(user.entityId).toBeDefined();
      expect(user.entityName).toBe("user");
      expect(user.nickname).toBe("TestUser");
      expect(user.email).toBe("test@example.com");
      expect(user[" $$queuedEvents"].length).toBe(1);

      const event = user[" $$queuedEvents"][0];
      expect(event?.eventName).toBe("user:created");
      expect(event?.body).toEqual({
        nickname: "TestUser",
        email: "test@example.com",
      });
    });

    test("should create entity with custom entityId", () => {
      const customId = "custom-id-123";
      const user = User.create({
        entityId: customId,
        body: {
          nickname: "CustomUser",
          email: "custom@example.com",
        },
      });

      expect(user.entityId).toBe(customId);
      expect(user[" $$queuedEvents"][0]?.entityId).toBe(customId);
    });

    test("should use custom ID generator from schema", () => {
      let idCounter = 1000;

      const schema = defineSchema("test", {
        event: {
          created: v.object({ value: v.string() }),
        },
        state: v.object({ value: v.string() }),
        initialEventName: "created",
        generateId: () => `test-${idCounter++}`,
      });

      const reducer = defineReducer(schema, (_, event) => {
        if (event.eventName === "test:created") {
          return { value: event.body.value };
        }
        return { value: "" };
      });

      const TestEntity = Entity(schema, reducer);

      const entity1 = TestEntity.create({
        body: { value: "first" },
      });
      const entity2 = TestEntity.create({
        body: { value: "second" },
      });

      // generateId is called twice for entity1: once for entityId, once for the initial event's eventId
      expect(entity1.entityId).toBe("test-1000");
      expect(entity1[" $$queuedEvents"][0]?.eventId).toBe("test-1001");

      // generateId is called twice for entity2: once for entityId, once for the initial event's eventId
      expect(entity2.entityId).toBe("test-1002");
      expect(entity2[" $$queuedEvents"][0]?.eventId).toBe("test-1003");
    });
  });

  describe("Event Dispatching", () => {
    test("should queue events and update state", () => {
      const user = User.create({
        body: {
          nickname: "Alice",
          email: "alice@example.com",
        },
      });

      // Initial state
      expect(user[" $$queuedEvents"].length).toBe(1);
      expect(user.nickname).toBe("Alice");

      // Update profile
      user.updateProfile({
        nickname: "Alice Updated",
        bio: "Software Developer",
      });

      expect(user[" $$queuedEvents"].length).toBe(2);
      expect(user.nickname).toBe("Alice Updated");
      expect(user.bio).toBe("Software Developer");

      // Delete user
      user.delete("Test deletion");

      expect(user[" $$queuedEvents"].length).toBe(3);
      expect(user.isDeleted).toBe(true);

      // Restore user
      user.restore();

      expect(user[" $$queuedEvents"].length).toBe(4);
      expect(user.isDeleted).toBe(false);
    });

    test("should maintain event metadata correctly", () => {
      const user = User.create({
        entityId: "user-456",
        body: {
          nickname: "Bob",
          email: "bob@example.com",
        },
      });

      const event = user[" $$queuedEvents"][0];

      expect(event).toBeDefined();
      expect(event?.eventId).toBeDefined();
      expect(event?.eventName).toBe("user:created");
      expect(event?.eventCreatedAt).toBeDefined();
      expect(event?.entityId).toBe("user-456");
      expect(event?.entityName).toBe("user");

      // Verify timestamp format
      const timestamp = new Date(event!.eventCreatedAt);
      expect(timestamp).toBeInstanceOf(Date);
      expect(Number.isNaN(timestamp.getTime())).toBe(false);
    });

    test("should flush queued events", () => {
      const user = User.create({
        body: {
          nickname: "Charlie",
          email: "charlie@example.com",
        },
      });

      user.updateProfile({ bio: "Developer" });
      expect(user[" $$queuedEvents"].length).toBe(2);

      user[" $$flush"]();
      expect(user[" $$queuedEvents"].length).toBe(0);

      // State should remain unchanged after flush
      expect(user.nickname).toBe("Charlie");
      expect(user.bio).toBe("Developer");
    });
  });

  describe("Entity Hydration", () => {
    test("should hydrate entity from events", () => {
      const events = [
        {
          eventId: "evt-1",
          eventName: "user:created" as const,
          eventCreatedAt: "2024-01-01T00:00:00Z",
          entityId: "user-789",
          entityName: "user",
          body: {
            nickname: "Dave",
            email: "dave@example.com",
          },
        },
        {
          eventId: "evt-2",
          eventName: "user:profile_updated" as const,
          eventCreatedAt: "2024-01-01T01:00:00Z",
          entityId: "user-789",
          entityName: "user",
          body: {
            bio: "Senior Developer",
          },
        },
        {
          eventId: "evt-3",
          eventName: "user:deleted" as const,
          eventCreatedAt: "2024-01-01T02:00:00Z",
          entityId: "user-789",
          entityName: "user",
          body: {
            reason: "Account closure",
          },
        },
      ];

      const user = User[" $$loadFromEvents"]({
        entityId: "user-789",
        events,
      });

      expect(user.nickname).toBe("Dave");
      expect(user.email).toBe("dave@example.com");
      expect(user.bio).toBe("Senior Developer");
      expect(user.isDeleted).toBe(true);
    });

    test("should throw when hydrating already initialized entity", () => {
      const user = User.create({
        body: {
          nickname: "Eve",
          email: "eve@example.com",
        },
      });

      const events = [
        {
          eventId: "evt-1",
          eventName: "user:created" as const,
          eventCreatedAt: "2024-01-01T00:00:00Z",
          entityId: user.entityId,
          entityName: "user",
          body: {
            nickname: "Eve",
            email: "eve@example.com",
          },
        },
      ];

      // Cannot load from events twice
      const firstLoad = User[" $$loadFromEvents"]({
        entityId: "user-double-load",
        events,
      });

      // This should work without throwing
      expect(firstLoad.nickname).toBe("Eve");
    });

    test("should validate events during hydration", () => {
      const invalidEvents = [
        {
          eventId: "evt-1",
          eventName: "user:created" as const,
          eventCreatedAt: "2024-01-01T00:00:00Z",
          entityId: "user-invalid",
          entityName: "user",
          // Missing required fields
          body: {
            nickname: "Invalid",
          },
        },
      ] as any;

      expect(() =>
        User[" $$loadFromEvents"]({
          entityId: "user-invalid",
          events: invalidEvents,
        }),
      ).toThrow();
    });

    test("should handle empty event array during hydration", () => {
      const user = User[" $$loadFromEvents"]({
        entityId: "user-empty",
        events: [],
      });

      // State should remain null
      expect(() => user.state).toThrow("Entity is not initialized");
    });
  });

  describe("Entity Read-Only Mode (CQRS)", () => {
    test("should prevent dispatch on entities loaded with state", () => {
      const loadedUser = User.load({
        entityId: "readonly-user",
        state: {
          nickname: "ReadOnlyUser",
          email: "readonly@example.com",
          bio: "This is a read-only user",
          deletedAt: null,
        },
      });

      // Should be able to read state
      expect(loadedUser.nickname).toBe("ReadOnlyUser");
      expect(loadedUser.email).toBe("readonly@example.com");
      expect(loadedUser.bio).toBe("This is a read-only user");

      // Should not be able to dispatch events
      expect(() => {
        loadedUser.updateProfile({ bio: "Trying to update" });
      }).toThrow("Entity is readonly");

      expect(() => {
        loadedUser.delete("Trying to delete");
      }).toThrow("Entity is readonly");

      expect(() => {
        loadedUser.dispatch("user:profile_updated", { bio: "Direct dispatch" });
      }).toThrow("Entity is readonly");
    });

    test("Order: should be readonly when loaded with state", () => {
      const loadedOrder = Order.load({
        entityId: "readonly-order",
        state: {
          customerId: "customer-readonly",
          items: [
            { productId: "prod-1", quantity: 2, price: 50 },
            { productId: "prod-2", quantity: 1, price: 100 },
          ],
          status: "confirmed" as const,
          totalAmount: 200,
          paymentMethod: "card" as const,
          shipping: undefined,
          deliveredAt: undefined,
          cancelReason: undefined,
        },
      });

      // Should be able to read state
      expect(loadedOrder.customerId).toBe("customer-readonly");
      expect(loadedOrder.totalAmount).toBe(200);
      expect(loadedOrder.status).toBe("confirmed");

      // Should not be able to modify
      expect(() => {
        loadedOrder.ship("TRACK123", "Express");
      }).toThrow("Entity is readonly");

      expect(() => {
        loadedOrder.cancel("Trying to cancel", "customer");
      }).toThrow("Entity is readonly");

      expect(() => {
        loadedOrder.dispatch("order:shipped", {
          trackingNumber: "TRACK456",
          carrier: "UPS",
        });
      }).toThrow("Entity is readonly");
    });

    test("should distinguish between created entities and loaded entities", () => {
      // Created entity should be mutable
      const createdUser = User.create({
        body: {
          nickname: "MutableUser",
          email: "mutable@example.com",
        },
      });

      // This should work
      createdUser.updateProfile({ bio: "Can be updated" });
      expect(createdUser.bio).toBe("Can be updated");

      // Loaded entity should be immutable
      const loadedUser = User.load({
        entityId: "loaded-user",
        state: {
          nickname: "ImmutableUser",
          email: "immutable@example.com",
          bio: "Cannot be updated",
          deletedAt: null,
        },
      });

      // This should fail
      expect(() => {
        loadedUser.updateProfile({ bio: "Trying to update" });
      }).toThrow("Entity is readonly");
    });

    test("should allow reading but not modifying loaded entities", () => {
      const state = {
        nickname: "TestUser",
        email: "test@example.com",
        bio: "Original bio",
        deletedAt: null,
      };

      const loadedUser = User.load({
        entityId: "test-user",
        state,
      });

      // All getters should work
      expect(loadedUser.nickname).toBe("TestUser");
      expect(loadedUser.email).toBe("test@example.com");
      expect(loadedUser.bio).toBe("Original bio");
      expect(loadedUser.isDeleted).toBe(false);
      expect(loadedUser.entityId).toBe("test-user");
      expect(loadedUser.entityName).toBe("user");
      expect(loadedUser.state).toEqual(state);

      // But all mutations should fail
      expect(() => loadedUser.updateProfile({ bio: "New bio" })).toThrow(
        "Entity is readonly",
      );
      expect(() => loadedUser.delete()).toThrow("Entity is readonly");

      // State should remain unchanged
      expect(loadedUser.bio).toBe("Original bio");
    });
  });

  describe("Business Logic Validation", () => {
    test("User: should enforce business rules", () => {
      const user = User.create({
        body: {
          nickname: "Frank",
          email: "frank@example.com",
        },
      });

      // Delete user
      user.delete();
      expect(user.isDeleted).toBe(true);

      // Cannot update deleted user
      expect(() => {
        user.updateProfile({ nickname: "Frank Updated" });
      }).toThrow("Cannot update profile of deleted user");

      // Cannot delete already deleted user
      expect(() => {
        user.delete();
      }).toThrow("User is already deleted");

      // Can restore deleted user
      user.restore();
      expect(user.isDeleted).toBe(false);

      // Cannot restore non-deleted user
      expect(() => {
        user.restore();
      }).toThrow("User is not deleted");
    });

    test("Order: should enforce order workflow rules", () => {
      const order = Order.create({
        body: {
          customerId: "cust-123",
          items: [{ productId: "prod-1", quantity: 1, price: 99.99 }],
        },
      });

      // Can modify items in draft status
      expect(order.canModifyItems).toBe(true);
      order.addItem("prod-2", 2, 49.99);
      expect(order.items.length).toBe(2);

      // Cannot confirm empty order
      const emptyOrder = Order.create({
        body: {
          customerId: "cust-456",
          items: [],
        },
      });
      expect(() => {
        emptyOrder.confirm("card");
      }).toThrow("Cannot confirm order with no items");

      // Confirm order
      order.confirm("card");
      expect(order.status).toBe("confirmed");
      expect(order.canModifyItems).toBe(false);

      // Cannot add items after confirmation
      expect(() => {
        order.addItem("prod-3", 1, 29.99);
      }).toThrow("Cannot modify items in confirmed status");

      // Cannot confirm already confirmed order
      expect(() => {
        order.confirm("paypal");
      }).toThrow("Cannot confirm order in confirmed status");

      // Ship order
      expect(order.canShip).toBe(true);
      order.ship("TRACK123", "FedEx");
      expect(order.status).toBe("shipped");
      expect(order.canShip).toBe(false);

      // Cannot ship already shipped order
      expect(() => {
        order.ship("TRACK456", "UPS");
      }).toThrow("Cannot ship order in shipped status");

      // Deliver order
      expect(order.canDeliver).toBe(true);
      order.markAsDelivered("Customer signature");
      expect(order.status).toBe("delivered");

      // Cannot cancel delivered order
      expect(() => {
        order.cancel("Too late", "customer");
      }).toThrow("Cannot cancel order in delivered status");
    });

    test("Order: should handle item operations correctly", () => {
      const order = Order.create({
        body: {
          customerId: "cust-789",
          items: [{ productId: "prod-1", quantity: 2, price: 50 }],
        },
      });

      expect(order.totalAmount).toBe(100);

      // Add new item
      order.addItem("prod-2", 3, 30);
      expect(order.totalAmount).toBe(190);
      expect(order.items.length).toBe(2);

      // Add quantity to existing item
      order.addItem("prod-1", 1, 50);
      expect(order.items.find((i) => i.productId === "prod-1")?.quantity).toBe(
        3,
      );
      expect(order.totalAmount).toBe(240);

      // Remove item
      order.removeItem("prod-2");
      expect(order.items.length).toBe(1);
      expect(order.totalAmount).toBe(150);

      // Cannot remove non-existent item
      expect(() => {
        order.removeItem("prod-3");
      }).toThrow("Item prod-3 not found in order");
    });
  });

  describe("State Getter", () => {
    test("should throw when accessing state before initialization", () => {
      const user = User[" $$loadFromEvents"]({
        entityId: "user-no-init",
        events: [],
      });

      expect(() => user.state).toThrow("Entity is not initialized");
    });

    test("should return state after initialization", () => {
      const user = User.create({
        body: {
          nickname: "Grace",
          email: "grace@example.com",
        },
      });

      const state = user.state;
      expect(state).toBeDefined();
      expect(state.nickname).toBe("Grace");
      expect(state.email).toBe("grace@example.com");
      expect(state.bio).toBeUndefined();
      expect(state.deletedAt).toBeNull();
    });

    test("should reflect state changes immediately", () => {
      const user = User.create({
        body: {
          nickname: "Henry",
          email: "henry@example.com",
        },
      });

      const state1 = user.state;
      expect(state1.bio).toBeUndefined();

      user.updateProfile({ bio: "Engineer" });

      const state2 = user.state;
      expect(state2.bio).toBe("Engineer");

      // Note: Since reducer returns a new object, state1 and state2 are different references
      // state1 still points to the old state object
      expect(state1.bio).toBeUndefined();
      expect(state1).not.toBe(state2);
    });
  });

  describe("Event Queue Overflow", () => {
    test("should throw error when event queue exceeds max limit", () => {
      const schema = defineSchema("test", {
        event: {
          created: v.object({ value: v.string() }),
          updated: v.object({ value: v.string() }),
        },
        state: v.object({ value: v.string(), counter: v.number() }),
        initialEventName: "created",
      });

      const reducer = defineReducer(schema, (prevState, event) => {
        if (event.eventName === "test:created") {
          return { value: event.body.value, counter: 0 };
        }
        if (event.eventName === "test:updated") {
          return {
            value: event.body.value,
            counter: prevState.counter + 1,
          };
        }
        return prevState;
      });

      // Create entity with small queue limit
      const TestEntity = Entity(schema, reducer, { maxQueuedEvents: 5 });

      const entity = TestEntity.create({
        body: { value: "initial" },
      });

      // First event is the initial event, so we can add 4 more
      entity.dispatch("test:updated", { value: "update1" });
      entity.dispatch("test:updated", { value: "update2" });
      entity.dispatch("test:updated", { value: "update3" });
      entity.dispatch("test:updated", { value: "update4" });

      // This should throw as it exceeds the limit of 5
      expect(() => {
        entity.dispatch("test:updated", { value: "update5" });
      }).toThrow("Event queue overflow: maximum 5 uncommitted events exceeded");
    });

    test("should handle large number of events with default limit", () => {
      const user = User.create({
        body: {
          nickname: "StressTest",
          email: "stress@test.com",
        },
      });

      // Default limit is 10000, so adding 9999 more should be fine
      for (let i = 0; i < 9999; i++) {
        user.updateProfile({ bio: `Update ${i}` });
      }

      expect(user[" $$queuedEvents"].length).toBe(10000);
    });
  });

  describe("Edge Cases", () => {
    test("should handle optional event body fields", () => {
      const user = User.create({
        body: {
          nickname: "Ivy",
          email: "ivy@example.com",
        },
      });

      // Update with only bio
      user.updateProfile({ bio: "Designer" });
      expect(user.nickname).toBe("Ivy"); // Should remain unchanged
      expect(user.bio).toBe("Designer");

      // Update with only nickname
      user.updateProfile({ nickname: "Ivy Updated" });
      expect(user.nickname).toBe("Ivy Updated");
      expect(user.bio).toBe("Designer"); // Should remain unchanged
    });

    test("should handle complex state transitions", () => {
      const order = Order.create({
        body: {
          customerId: "cust-complex",
          items: [
            { productId: "prod-1", quantity: 1, price: 100 },
            { productId: "prod-2", quantity: 2, price: 50 },
          ],
        },
      });

      // Initial state
      expect(order.totalAmount).toBe(200);

      // Modify items
      order.addItem("prod-1", 2, 100); // Add to existing
      expect(order.totalAmount).toBe(400);

      order.removeItem("prod-2");
      expect(order.totalAmount).toBe(300);

      // Confirm and ship
      order.confirm("paypal");
      order.ship("SHIP999", "DHL");

      // Cancel before delivery
      order.cancel("Customer request", "customer");
      expect(order.status).toBe("cancelled");
      expect(order.state.cancelReason).toBe("Customer request");
    });

    test("should generate unique event IDs", () => {
      const user = User.create({
        body: {
          nickname: "Jack",
          email: "jack@example.com",
        },
      });

      user.updateProfile({ bio: "Bio 1" });
      user.updateProfile({ bio: "Bio 2" });

      const eventIds = user[" $$queuedEvents"].map((e) => e?.eventId);
      const uniqueIds = new Set(eventIds);

      expect(uniqueIds.size).toBe(3);
      eventIds.forEach((id) => {
        expect(id).toBeDefined();
        expect(typeof id).toBe("string");
      });
    });
  });

  describe("Custom Namespace Separator", () => {
    test("should use default separator (:) when not specified", () => {
      const schema = defineSchema("product", {
        event: {
          created: v.object({ name: v.string() }),
        },
        state: v.object({ name: v.string() }),
        initialEventName: "created",
      });

      const reducer = defineReducer(schema, (_, event) => {
        if (event.eventName === "product:created") {
          return { name: event.body.name };
        }
        return { name: "" };
      });

      const ProductEntity = Entity(schema, reducer);
      const product = ProductEntity.create({
        body: { name: "Test Product" },
      });

      const event = product[" $$queuedEvents"][0];
      expect(event?.eventName).toBe("product:created");
    });

    test("should use custom separator when specified", () => {
      const schema = defineSchema("product", {
        event: {
          created: v.object({ name: v.string() }),
          updated: v.object({ name: v.string() }),
        },
        state: v.object({ name: v.string() }),
        initialEventName: "created",
        namespaceSeparator: "/",
      });

      const reducer = defineReducer(schema, (prevState, event) => {
        if (
          event.eventName === "product/created" ||
          event.eventName === "product/updated"
        ) {
          return { name: (event as any).body.name };
        }
        return prevState;
      });

      const ProductEntity = Entity(schema, reducer);
      const product = ProductEntity.create({
        body: { name: "Test Product" },
      });

      // Check initial event - runtime uses custom separator
      const createEvent = product[" $$queuedEvents"][0];
      expect(createEvent?.eventName).toBe("product/created");

      // Dispatch another event - runtime uses custom separator
      // Type assertion needed because type system uses ":"
      product.dispatch("product/updated" as any, { name: "Updated Product" });
      const updateEvent = product[" $$queuedEvents"][1];
      expect(updateEvent?.eventName).toBe("product/updated");
    });

    test("should use separator consistently across all events", () => {
      const schema = defineSchema("order", {
        event: {
          created: v.object({ total: v.number() }),
          confirmed: v.object({}),
          shipped: v.object({ trackingNumber: v.string() }),
          delivered: v.object({}),
        },
        state: v.object({
          total: v.number(),
          status: v.string(),
          trackingNumber: v.optional(v.string()),
        }),
        initialEventName: "created",
        namespaceSeparator: ".",
      });

      const reducer = defineReducer(schema, (prevState, event) => {
        if (event.eventName === "order.created") {
          return { total: event.body.total, status: "created" };
        }
        if (event.eventName === "order.confirmed") {
          return { ...prevState, status: "confirmed" };
        }
        if (event.eventName === "order.shipped") {
          return {
            ...prevState,
            status: "shipped",
            trackingNumber: event.body.trackingNumber,
          };
        }
        if (event.eventName === "order.delivered") {
          return { ...prevState, status: "delivered" };
        }
        return prevState;
      });

      const OrderEntity = Entity(schema, reducer);
      const order = OrderEntity.create({
        body: { total: 100 },
      });

      // Runtime uses custom separator, type assertions needed
      order.dispatch("order.confirmed" as any, {});
      order.dispatch("order.shipped" as any, { trackingNumber: "TRACK123" });
      order.dispatch("order.delivered" as any, {});

      const eventNames = order[" $$queuedEvents"].map((e) => e?.eventName);
      expect(eventNames).toEqual([
        "order.created",
        "order.confirmed",
        "order.shipped",
        "order.delivered",
      ]);
    });
  });
});
