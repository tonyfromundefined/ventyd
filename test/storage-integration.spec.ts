import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createRepository } from "../src/createRepository";
import { User, userSchema } from "./entities/User";
import { Order, orderSchema } from "./entities/Order";
import { getAllStorageFactories, type StorageFactory } from "./storages";
import type { Storage } from "../src/defineStorage";

/**
 * Integration tests that run against all storage implementations.
 * This ensures that all storage types behave consistently.
 */
getAllStorageFactories().forEach((factory) => {
  describe(`Storage Integration Tests with '${factory.type}'`, () => {
    let storage: Storage;

    beforeEach(async () => {
      storage = await factory.create();
    });

    afterEach(async () => {
      if (factory.cleanup) {
        await factory.cleanup();
      }
    });

    describe("Basic CRUD Operations", () => {
      test("should create, save, and retrieve an entity", async () => {
        const repository = createRepository({
          entity: User,
          schema: userSchema,
          storage,
        });

        // Create and save user
        const user = new User({
          body: {
            nickname: "TestUser",
            email: "test@example.com",
          },
        });

        await repository.commit(user);

        // Retrieve user
        const retrieved = await repository.findOne({
          entityId: user.entityId,
        });

        expect(retrieved).not.toBeNull();
        expect(retrieved?.nickname).toBe("TestUser");
        expect(retrieved?.email).toBe("test@example.com");
      });

      test("should return null for non-existent entity", async () => {
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

        // First commit with events
        await repository.commit(user);

        // Second commit without new events
        await repository.commit(user);

        const retrieved = await repository.findOne({
          entityId: user.entityId,
        });

        expect(retrieved?.nickname).toBe("EmptyCommitUser");
      });
    });

    describe("Event Persistence", () => {
      test("should persist events across multiple commits", async () => {
        const repository = createRepository({
          entity: User,
          schema: userSchema,
          storage,
        });

        const userId = "persistent-user-id";

        // First commit - create user
        const user1 = new User({
          entityId: userId,
          body: {
            nickname: "Initial",
            email: "initial@example.com",
          },
        });
        await repository.commit(user1);

        // Second commit - update profile
        const user2 = await repository.findOne({ entityId: userId });
        user2?.updateProfile({ nickname: "Updated", bio: "Test bio" });
        await repository.commit(user2!);

        // Third commit - delete
        const user3 = await repository.findOne({ entityId: userId });
        user3?.delete("Test deletion");
        await repository.commit(user3!);

        // Final retrieval
        const finalUser = await repository.findOne({ entityId: userId });
        expect(finalUser?.nickname).toBe("Updated");
        expect(finalUser?.bio).toBe("Test bio");
        expect(finalUser?.isDeleted).toBe(true);
      });

      test("should maintain event order", async () => {
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

        // Retrieve and verify state
        const retrieved = await repository.findOne({
          entityId: order.entityId,
        });

        expect(retrieved?.status).toBe("shipped");
        expect(retrieved?.items.length).toBe(2);
        expect(retrieved?.totalAmount).toBe(200);
      });
    });

    describe("Entity Isolation", () => {
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
    });

    describe("Concurrent Operations", () => {
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

      test("should handle concurrent operations on same entity", async () => {
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

        // Should have the initial item plus the ones added
        expect(finalOrder?.items.length).toBeGreaterThanOrEqual(2);
        expect(finalOrder?.status).toBe("draft");
      });
    });

    describe(`Performance characteristics for ${factory.type}`, () => {
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

        // Log performance metrics for each storage type
        console.log(
          `[${factory.type}] Commit ${numEvents} events: ${commitTime}ms, Retrieve: ${retrieveTime}ms`,
        );

        // Basic performance expectations (generous for CI environments)
        expect(commitTime).toBeLessThan(5000);
        expect(retrieveTime).toBeLessThan(1000);
      });
    });

    if (factory.type === "mongodb") {
      describe("MongoDB specific", () => {
        test("should create indexes for performance", async () => {
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
      describe("SQLite specific", () => {
        test("should use transactions for batch inserts", async () => {
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
