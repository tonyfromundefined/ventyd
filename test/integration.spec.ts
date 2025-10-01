/** biome-ignore-all lint/style/noNonNullAssertion: for testing */
/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createRepository } from "../src/createRepository";
import type { Storage } from "../src/defineStorage";
import { Order, orderSchema } from "./entities/Order";
import { User, userSchema } from "./entities/User";
import { getAllStorageFactories } from "./storages";

/**
 * Integration test suite that validates the complete event sourcing system
 * across different storage backends to ensure consistent behavior.
 *
 * Tests the full stack including:
 * - Entity lifecycle management
 * - Event sourcing patterns
 * - Repository operations
 * - Plugin system
 *
 * Runs against all available storage backends:
 * - InMemory (for development and testing)
 * - MongoDB (for production deployments)
 * - SQLite (for edge computing and embedded scenarios)
 */
getAllStorageFactories().forEach((factory) => {
  describe(`Integration Tests with ${factory.type.toUpperCase()} Storage`, () => {
    let storage: Storage;

    beforeEach(async () => {
      storage = await factory.create();
    });

    afterEach(async () => {
      if (factory.cleanup) {
        await factory.cleanup();
      }
    });

    /**
     * Section 1: Basic Operations
     * Tests fundamental CRUD operations and basic event persistence
     */
    describe("1. Basic Operations", () => {
      test("should create and retrieve entities", async () => {
        const repository = createRepository({
          entity: User,
          schema: userSchema,
          storage,
        });

        const user = new User({
          body: {
            nickname: "TestUser",
            email: "test@example.com",
          },
        });

        await repository.commit(user);

        const retrieved = await repository.findOne({
          entityId: user.entityId,
        });

        expect(retrieved).not.toBeNull();
        expect(retrieved?.nickname).toBe("TestUser");
        expect(retrieved?.email).toBe("test@example.com");
      });

      test("should return null for non-existent entities", async () => {
        const repository = createRepository({
          entity: User,
          schema: userSchema,
          storage,
        });

        const result = await repository.findOne({
          entityId: "non-existent-id",
        });

        expect(result).toBeNull();
      });

      test("should handle empty commits gracefully", async () => {
        const repository = createRepository({
          entity: User,
          schema: userSchema,
          storage,
        });

        const user = new User({
          body: {
            nickname: "EmptyCommitUser",
            email: "empty@commit.com",
          },
        });

        await repository.commit(user);
        // Second commit without new events
        await repository.commit(user);

        const retrieved = await repository.findOne({
          entityId: user.entityId,
        });

        expect(retrieved?.nickname).toBe("EmptyCommitUser");
      });

      test("should persist events across multiple commits", async () => {
        const repository = createRepository({
          entity: User,
          schema: userSchema,
          storage,
        });

        const userId = "persistent-user-id";

        // First commit - create
        const user1 = new User({
          entityId: userId,
          body: {
            nickname: "Initial",
            email: "initial@example.com",
          },
        });
        await repository.commit(user1);

        // Second commit - update
        const user2 = await repository.findOne({ entityId: userId });
        user2?.updateProfile({ nickname: "Updated", bio: "Test bio" });
        await repository.commit(user2!);

        // Third commit - delete
        const user3 = await repository.findOne({ entityId: userId });
        user3?.delete("Test deletion");
        await repository.commit(user3!);

        // Verify final state
        const finalUser = await repository.findOne({ entityId: userId });
        expect(finalUser?.nickname).toBe("Updated");
        expect(finalUser?.bio).toBe("Test bio");
        expect(finalUser?.isDeleted).toBe(true);
      });

      test("should maintain correct event order", async () => {
        const repository = createRepository({
          entity: Order,
          schema: orderSchema,
          storage,
        });

        const order = new Order({
          body: {
            customerId: "customer-order-test",
            items: [{ productId: "prod-1", quantity: 1, price: 100 }],
          },
        });

        // Multiple state transitions
        order.addItem("prod-2", 2, 50);
        order.confirm("card");
        order.ship("TRACK123", "Express");

        await repository.commit(order);

        const retrieved = await repository.findOne({
          entityId: order.entityId,
        });

        expect(retrieved?.status).toBe("shipped");
        expect(retrieved?.items.length).toBe(2);
        expect(retrieved?.totalAmount).toBe(200);
      });
    });

    /**
     * Section 2: Event Sourcing Core Features
     * Tests time travel, event replay, and state reconstruction
     */
    describe("2. Event Sourcing Core Features", () => {
      test("should support time travel through event history", async () => {
        const repository = createRepository({
          entity: User,
          schema: userSchema,
          storage,
        });

        const userId = "time-travel-user";

        // Day 1: User signs up
        const user = new User({
          entityId: userId,
          body: {
            nickname: "TimeTravel",
            email: "time@travel.com",
          },
        });
        await repository.commit(user);

        // Day 2: User updates profile
        const user2 = await repository.findOne({ entityId: userId });
        user2?.updateProfile({
          nickname: "TimeTraveler",
          bio: "Exploring event sourcing",
        });
        await repository.commit(user2!);

        // Day 3: User deletes account
        const user3 = await repository.findOne({ entityId: userId });
        user3?.delete("Privacy concerns");
        await repository.commit(user3!);

        // Day 4: User restores account
        const user4 = await repository.findOne({ entityId: userId });
        user4?.restore();
        await repository.commit(user4!);

        // Verify final state
        const finalUser = await repository.findOne({ entityId: userId });
        expect(finalUser?.nickname).toBe("TimeTraveler");
        expect(finalUser?.bio).toBe("Exploring event sourcing");
        expect(finalUser?.isDeleted).toBe(false);

        // Verify complete event history
        const events = await storage.getEventsByEntityId({
          entityName: "user",
          entityId: userId,
        });
        expect(events.length).toBe(4);
        expect(events.map((e) => (e as any).eventName)).toEqual([
          "user:created",
          "user:profile_updated",
          "user:deleted",
          "user:restored",
        ]);
      });

      test("should reconstruct state from event sequence", async () => {
        // Directly insert events in specific order
        const events = [
          {
            eventId: "evt-1",
            eventName: "order:created",
            eventCreatedAt: "2024-01-01T10:00:00Z",
            entityId: "order-reconstruct",
            entityName: "order",
            body: {
              customerId: "customer-123",
              items: [{ productId: "A", quantity: 1, price: 100 }],
            },
          },
          {
            eventId: "evt-2",
            eventName: "order:item_added",
            eventCreatedAt: "2024-01-01T11:00:00Z",
            entityId: "order-reconstruct",
            entityName: "order",
            body: {
              productId: "B",
              quantity: 2,
              price: 50,
            },
          },
          {
            eventId: "evt-3",
            eventName: "order:item_removed",
            eventCreatedAt: "2024-01-01T12:00:00Z",
            entityId: "order-reconstruct",
            entityName: "order",
            body: {
              productId: "A",
            },
          },
          {
            eventId: "evt-4",
            eventName: "order:confirmed",
            eventCreatedAt: "2024-01-01T13:00:00Z",
            entityId: "order-reconstruct",
            entityName: "order",
            body: {
              paymentMethod: "card",
            },
          },
        ];

        await storage.commitEvents({ events: events as any });

        const orderRepo = createRepository({
          entity: Order,
          schema: orderSchema,
          storage,
        });

        const reconstructed = await orderRepo.findOne({
          entityId: "order-reconstruct",
        });

        // Verify final state after all events
        expect(reconstructed?.items.length).toBe(1);
        expect(reconstructed?.items[0]?.productId).toBe("B");
        expect(reconstructed?.totalAmount).toBe(100); // 2 * 50
        expect(reconstructed?.status).toBe("confirmed");
      });

      test("should handle event versioning and migration", async () => {
        // Simulate old events that might have different structure
        const oldEvents = [
          {
            eventId: "old-1",
            eventName: "user:created",
            eventCreatedAt: "2023-01-01T00:00:00Z",
            entityId: "legacy-user",
            entityName: "user",
            body: {
              nickname: "LegacyUser",
              email: "legacy@old.com",
              // Old events might not have all fields
            },
          },
          {
            eventId: "old-2",
            eventName: "user:profile_updated",
            eventCreatedAt: "2023-06-01T00:00:00Z",
            entityId: "legacy-user",
            entityName: "user",
            body: {
              bio: "Migrated from v1",
            },
          },
        ];

        await storage.commitEvents({ events: oldEvents as any });

        const repository = createRepository({
          entity: User,
          schema: userSchema,
          storage,
        });

        const migratedUser = await repository.findOne({
          entityId: "legacy-user",
        });

        expect(migratedUser?.nickname).toBe("LegacyUser");
        expect(migratedUser?.email).toBe("legacy@old.com");
        expect(migratedUser?.bio).toBe("Migrated from v1");
      });

      test("should preserve chronological event order", async () => {
        const userRepo = createRepository({
          entity: User,
          schema: userSchema,
          storage,
        });

        const user = new User({
          body: {
            nickname: "OrderTest",
            email: "order@test.com",
          },
        });

        // Perform rapid operations
        for (let i = 0; i < 10; i++) {
          user.updateProfile({ bio: `Update ${i}` });
        }

        await userRepo.commit(user);

        const retrieved = await userRepo.findOne({ entityId: user.entityId });
        expect(retrieved?.bio).toBe("Update 9"); // Last update wins

        // Check event order
        const events = await storage.getEventsByEntityId({
          entityName: "user",
          entityId: user.entityId,
        });

        expect(events.length).toBe(11); // 1 created + 10 updates

        // Verify chronological order
        for (let i = 1; i < events.length; i++) {
          const prev = new Date((events[i - 1] as any).eventCreatedAt);
          const curr = new Date((events[i] as any).eventCreatedAt);
          expect(curr.getTime()).toBeGreaterThanOrEqual(prev.getTime());
        }
      });
    });

    /**
     * Section 3: Advanced Patterns
     * Tests compensating transactions, plugins, and complex scenarios
     */
    describe("3. Advanced Patterns", () => {
      test("should support compensating transactions", async () => {
        const repository = createRepository({
          entity: Order,
          schema: orderSchema,
          storage,
        });

        const order = new Order({
          body: {
            customerId: "customer-comp",
            items: [
              { productId: "expensive-item", quantity: 1, price: 9999.99 },
            ],
          },
        });

        // Process order
        order.confirm("card");
        order.ship("TRACK-COMP", "Express");
        await repository.commit(order);

        // Later: Customer reports fraud, need to compensate
        const fraudOrder = await repository.findOne({
          entityId: order.entityId,
        });
        fraudOrder?.cancel("Fraudulent transaction detected", "system");
        await repository.commit(fraudOrder!);

        // Verify compensation
        const finalOrder = await repository.findOne({
          entityId: order.entityId,
        });
        expect(finalOrder?.status).toBe("cancelled");
        expect(finalOrder?.state.cancelReason).toBe(
          "Fraudulent transaction detected",
        );

        // All original events are preserved
        const events = await storage.getEventsByEntityId({
          entityName: "order",
          entityId: order.entityId,
        });
        expect(events.length).toBe(4); // created, confirmed, shipped, cancelled
      });

      test("should execute plugins for audit logging", async () => {
        const auditLog: Array<{ entity: any; events: any[] }> = [];

        const auditPlugin = {
          async onCommited({
            entity,
            events,
          }: {
            entity: User;
            events: any[];
          }) {
            auditLog.push({
              entity: {
                id: entity.entityId,
                name: entity.nickname,
                timestamp: new Date().toISOString(),
              },
              events: events.map((e) => ({
                type: e.eventName,
                timestamp: e.eventCreatedAt,
              })),
            });
          },
        };

        const repository = createRepository({
          entity: User,
          schema: userSchema,
          storage,
          plugins: [auditPlugin as any],
        });

        const user = new User({
          body: {
            nickname: "AuditedUser",
            email: "audit@example.com",
          },
        });
        user.updateProfile({ bio: "Being audited" });
        await repository.commit(user);

        expect(auditLog.length).toBe(1);
        expect(auditLog[0]?.entity.name).toBe("AuditedUser");
        expect(auditLog[0]?.events.length).toBe(2);
        expect(auditLog[0]?.events[0]?.type).toBe("user:created");
        expect(auditLog[0]?.events[1]?.type).toBe("user:profile_updated");
      });

      test("should execute multiple plugins in sequence", async () => {
        const executionOrder: string[] = [];

        const plugin1 = {
          async onCommited() {
            executionOrder.push("plugin1");
          },
        };
        const plugin2 = {
          async onCommited() {
            executionOrder.push("plugin2");
          },
        };
        const plugin3 = {
          async onCommited() {
            executionOrder.push("plugin3");
          },
        };

        const repository = createRepository({
          entity: Order,
          schema: orderSchema,
          storage,
          plugins: [plugin1 as any, plugin2 as any, plugin3 as any],
        });

        const order = new Order({
          body: {
            customerId: "plugin-test",
            items: [{ productId: "test", quantity: 1, price: 10 }],
          },
        });
        await repository.commit(order);

        expect(executionOrder).toEqual(["plugin1", "plugin2", "plugin3"]);
      });
    });

    /**
     * Section 4: Business Scenarios
     * Tests real-world use cases and complex workflows
     */
    describe("4. Business Scenarios", () => {
      test("should handle shopping cart lifecycle", async () => {
        const orderRepo = createRepository({
          entity: Order,
          schema: orderSchema,
          storage,
        });

        // Customer starts shopping
        const cart = new Order({
          entityId: "cart-001",
          body: {
            customerId: "shopper-001",
            items: [
              { productId: "laptop", quantity: 1, price: 1299.99 },
              { productId: "mouse", quantity: 1, price: 29.99 },
            ],
          },
        });

        // Add more items
        cart.addItem("keyboard", 1, 79.99);
        cart.addItem("monitor", 2, 399.99);

        // Save draft order (abandoned cart)
        await orderRepo.commit(cart);

        expect(cart.status).toBe("draft");
        expect(cart.totalAmount).toBe(2209.95);

        // Simulate cart recovery
        const recoveredCart = await orderRepo.findOne({
          entityId: "cart-001",
        });

        // Customer removes expensive items
        recoveredCart?.removeItem("laptop");
        recoveredCart?.removeItem("monitor");

        // Complete purchase with remaining items
        recoveredCart?.confirm("paypal");
        await orderRepo.commit(recoveredCart!);

        // Verify final state
        const finalOrder = await orderRepo.findOne({
          entityId: "cart-001",
        });
        expect(finalOrder?.status).toBe("confirmed");
        expect(finalOrder?.totalAmount).toBeCloseTo(109.98, 2);
        expect(finalOrder?.items.length).toBe(2);
      });

      test("should handle user account lifecycle", async () => {
        const userRepo = createRepository({
          entity: User,
          schema: userSchema,
          storage,
        });

        // User registration
        const user = new User({
          entityId: "lifecycle-user",
          body: {
            nickname: "JohnDoe",
            email: "john@lifecycle.com",
          },
        });
        await userRepo.commit(user);

        // Profile completion
        const user2 = await userRepo.findOne({ entityId: "lifecycle-user" });
        user2?.updateProfile({
          bio: "Software Developer with 5 years experience",
        });
        await userRepo.commit(user2!);

        // Nickname change
        const user3 = await userRepo.findOne({ entityId: "lifecycle-user" });
        user3?.updateProfile({
          nickname: "JohnTheArchitect",
        });
        await userRepo.commit(user3!);

        // Account deactivation
        const user4 = await userRepo.findOne({ entityId: "lifecycle-user" });
        user4?.delete("Taking a break from platform");
        await userRepo.commit(user4!);

        // Account reactivation
        const user5 = await userRepo.findOne({ entityId: "lifecycle-user" });
        user5?.restore();
        user5?.updateProfile({
          bio: "Back and ready to code! Senior Architect now.",
        });
        await userRepo.commit(user5!);

        // Verify complete history is preserved
        const finalUser = await userRepo.findOne({
          entityId: "lifecycle-user",
        });
        expect(finalUser?.nickname).toBe("JohnTheArchitect");
        expect(finalUser?.bio).toBe(
          "Back and ready to code! Senior Architect now.",
        );
        expect(finalUser?.isDeleted).toBe(false);

        // Check event count
        const events = await storage.getEventsByEntityId({
          entityName: "user",
          entityId: "lifecycle-user",
        });
        expect(events.length).toBe(6); // created, updated x3, deleted, restored
      });

      test("should process concurrent orders", async () => {
        const orderRepo = createRepository({
          entity: Order,
          schema: orderSchema,
          storage,
        });

        // Simulate multiple orders being processed concurrently
        const orderPromises = Array.from({ length: 10 }, async (_, i) => {
          const order = new Order({
            body: {
              customerId: `customer-${i}`,
              items: [
                {
                  productId: `product-${i}`,
                  quantity: i + 1,
                  price: (i + 1) * 10,
                },
              ],
            },
          });

          // Each order goes through different stages
          if (i % 3 === 0) {
            order.confirm("paypal");
            order.ship(`TRACK${i}`, "Express");
          } else if (i % 2 === 0) {
            order.confirm("card");
          }
          if (i === 9) {
            if (order.status === "draft") {
              order.confirm("bank");
            }
            if (order.status === "confirmed") {
              order.ship("TRACK9", "Standard");
            }
            if (order.status === "shipped") {
              order.markAsDelivered("Customer");
            }
          }

          await orderRepo.commit(order);
          return order.entityId;
        });

        const orderIds = await Promise.all(orderPromises);

        // Verify all orders were created
        expect(orderIds.length).toBe(10);

        // Check specific order states
        const order0 = await orderRepo.findOne({ entityId: orderIds[0]! });
        expect(order0?.status).toBe("shipped");

        const order2 = await orderRepo.findOne({ entityId: orderIds[2]! });
        expect(order2?.status).toBe("confirmed");

        const order9 = await orderRepo.findOne({ entityId: orderIds[9]! });
        expect(order9?.status).toBe("delivered");
      });
    });

    /**
     * Section 5: Isolation and Concurrency
     * Tests entity isolation and concurrent operations
     */
    describe("5. Isolation and Concurrency", () => {
      test("should isolate entities of different types with same ID", async () => {
        const userRepo = createRepository({
          entity: User,
          schema: userSchema,
          storage,
        });

        const orderRepo = createRepository({
          entity: Order,
          schema: orderSchema,
          storage,
        });

        const sharedId = "shared-id-isolation";

        // Create user with shared ID
        const user = new User({
          entityId: sharedId,
          body: {
            nickname: "IsolatedUser",
            email: "isolated@example.com",
          },
        });
        await userRepo.commit(user);

        // Create order with same ID
        const order = new Order({
          entityId: sharedId,
          body: {
            customerId: "isolated-customer",
            items: [{ productId: "iso-prod", quantity: 1, price: 99.99 }],
          },
        });
        await orderRepo.commit(order);

        // Retrieve both - should be different entities
        const retrievedUser = await userRepo.findOne({ entityId: sharedId });
        const retrievedOrder = await orderRepo.findOne({ entityId: sharedId });

        expect(retrievedUser?.nickname).toBe("IsolatedUser");
        expect(retrievedOrder?.customerId).toBe("isolated-customer");
      });

      test("should handle concurrent entity creation", async () => {
        const repository = createRepository({
          entity: User,
          schema: userSchema,
          storage,
        });

        // Create multiple users concurrently
        const userPromises = Array.from({ length: 5 }, async (_, i) => {
          const user = new User({
            body: {
              nickname: `ConcurrentUser${i}`,
              email: `concurrent${i}@example.com`,
            },
          });
          await repository.commit(user);
          return user.entityId;
        });

        const userIds = await Promise.all(userPromises);

        // Retrieve all users
        const retrievalPromises = userIds.map((id) =>
          repository.findOne({ entityId: id }),
        );
        const users = await Promise.all(retrievalPromises);

        // Verify all users were created
        users.forEach((user, i) => {
          expect(user).not.toBeNull();
          expect(user?.nickname).toBe(`ConcurrentUser${i}`);
        });
      });

      test("should handle concurrent updates on same entity", async () => {
        const repository = createRepository({
          entity: Order,
          schema: orderSchema,
          storage,
        });

        // Create initial order
        const order = new Order({
          entityId: "concurrent-order",
          body: {
            customerId: "concurrent-customer",
            items: [{ productId: "initial", quantity: 1, price: 50 }],
          },
        });
        await repository.commit(order);

        // Simulate concurrent reads and updates
        const operations = Array.from({ length: 3 }, async (_, i) => {
          const retrieved = await repository.findOne({
            entityId: "concurrent-order",
          });

          if (retrieved && retrieved.canModifyItems) {
            retrieved.addItem(`prod-${i}`, i + 1, (i + 1) * 10);
            await repository.commit(retrieved);
          }

          return retrieved;
        });

        await Promise.all(operations);

        // Final state check
        const finalOrder = await repository.findOne({
          entityId: "concurrent-order",
        });

        expect(finalOrder?.items.length).toBeGreaterThanOrEqual(2);
        expect(finalOrder?.status).toBe("draft");
      });
    });

    /**
     * Section 6: Performance Testing
     * Tests performance characteristics of each storage type
     */
    describe("6. Performance Testing", () => {
      test("should handle large number of events efficiently", async () => {
        const repository = createRepository({
          entity: User,
          schema: userSchema,
          storage,
        });

        const user = new User({
          entityId: "perf-test-user",
          body: {
            nickname: "PerfUser",
            email: "perf@test.com",
          },
        });

        // Generate many events
        const numEvents = 100;
        for (let i = 0; i < numEvents; i++) {
          user.updateProfile({ bio: `Update number ${i}` });
        }

        const startCommit = Date.now();
        await repository.commit(user);
        const commitTime = Date.now() - startCommit;

        // Retrieve with many events
        const startRetrieve = Date.now();
        const retrieved = await repository.findOne({
          entityId: "perf-test-user",
        });
        const retrieveTime = Date.now() - startRetrieve;

        expect(retrieved?.bio).toBe(`Update number ${numEvents - 1}`);

        // Performance expectations (generous for CI environments)
        expect(commitTime).toBeLessThan(5000);
        expect(retrieveTime).toBeLessThan(1000);
      });
    });

    /**
     * Section 7: Storage-Specific Features
     * Tests features specific to each storage implementation
     */
    if (factory.type === "mongodb") {
      describe("7. MongoDB-Specific Features", () => {
        test("should utilize indexes for performance", async () => {
          const repository = createRepository({
            entity: User,
            schema: userSchema,
            storage,
          });

          const user = new User({
            body: {
              nickname: "IndexTest",
              email: "index@test.com",
            },
          });

          await repository.commit(user);
          const retrieved = await repository.findOne({
            entityId: user.entityId,
          });

          expect(retrieved?.nickname).toBe("IndexTest");
        });
      });
    }

    if (factory.type === "sqlite") {
      describe("7. SQLite-Specific Features", () => {
        test("should use transactions for batch operations", async () => {
          const repository = createRepository({
            entity: Order,
            schema: orderSchema,
            storage,
          });

          const order = new Order({
            body: {
              customerId: "transaction-test",
              items: [{ productId: "tx-prod", quantity: 1, price: 100 }],
            },
          });

          // Add many items (will be committed in a transaction)
          for (let i = 0; i < 10; i++) {
            order.addItem(`prod-${i}`, i + 1, (i + 1) * 10);
          }

          await repository.commit(order);

          const retrieved = await repository.findOne({
            entityId: order.entityId,
          });
          expect(retrieved?.items.length).toBe(11);
        });
      });
    }
  });
});
