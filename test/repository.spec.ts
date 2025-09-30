import { describe, test, expect, beforeEach } from "vitest";
import { createRepository } from "../src/createRepository";
import { InMemoryStorage } from "./storages/InMemoryStorage";
import { User, userSchema } from "./entities/User";
import { Order, orderSchema } from "./entities/Order";

describe("Repository Integration Tests", () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  describe("User Repository", () => {
    test("should create, save, and retrieve a user", async () => {
      const repository = createRepository({
        entity: User,
        schema: userSchema,
        storage,
      });

      // 1. Create a new user
      const user = new User({
        body: {
          nickname: "Alice",
          email: "alice@example.com",
        },
      });

      expect(user.nickname).toBe("Alice");
      expect(user.email).toBe("alice@example.com");

      // 2. Save the user
      await repository.commit(user);

      // Verify events are flushed after commit
      expect(user[" $$queuedEvents"].length).toBe(0);

      // 3. Retrieve the user
      const retrievedUser = await repository.findOne({
        entityId: user.entityId,
      });

      expect(retrievedUser).not.toBeNull();
      expect(retrievedUser?.nickname).toBe("Alice");
      expect(retrievedUser?.email).toBe("alice@example.com");
      expect(retrievedUser?.entityId).toBe(user.entityId);
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

    test("should handle multiple events and maintain state correctly", async () => {
      const repository = createRepository({
        entity: User,
        schema: userSchema,
        storage,
      });

      // Create and save user
      const user = new User({
        body: {
          nickname: "Bob",
          email: "bob@example.com",
        },
      });

      // Update profile
      user.updateProfile({
        nickname: "Robert",
        bio: "Software Engineer",
      });

      // Delete user
      user.delete("Account closure requested");

      // Restore user
      user.restore();

      // Save all events
      await repository.commit(user);

      // Retrieve and verify final state
      const retrievedUser = await repository.findOne({
        entityId: user.entityId,
      });

      expect(retrievedUser?.nickname).toBe("Robert");
      expect(retrievedUser?.bio).toBe("Software Engineer");
      expect(retrievedUser?.isDeleted).toBe(false);
    });

    test("should persist events across multiple commits", async () => {
      const repository = createRepository({
        entity: User,
        schema: userSchema,
        storage,
      });

      // First commit - create user
      const user = new User({
        body: {
          nickname: "Charlie",
          email: "charlie@example.com",
        },
      });
      await repository.commit(user);

      // Second commit - update profile
      const retrievedUser1 = await repository.findOne({
        entityId: user.entityId,
      });
      retrievedUser1?.updateProfile({ bio: "Developer" });
      await repository.commit(retrievedUser1!);

      // Third commit - delete user
      const retrievedUser2 = await repository.findOne({
        entityId: user.entityId,
      });
      retrievedUser2?.delete();
      await repository.commit(retrievedUser2!);

      // Final retrieval - verify all events were applied
      const finalUser = await repository.findOne({
        entityId: user.entityId,
      });

      expect(finalUser?.nickname).toBe("Charlie");
      expect(finalUser?.bio).toBe("Developer");
      expect(finalUser?.isDeleted).toBe(true);
    });

    test("should maintain entity consistency with custom entityId", async () => {
      const repository = createRepository({
        entity: User,
        schema: userSchema,
        storage,
      });

      const customId = "custom-user-123";
      const user = new User({
        entityId: customId,
        body: {
          nickname: "Dave",
          email: "dave@example.com",
        },
      });

      expect(user.entityId).toBe(customId);

      await repository.commit(user);

      const retrievedUser = await repository.findOne({
        entityId: customId,
      });

      expect(retrievedUser?.entityId).toBe(customId);
    });
  });

  describe("Order Repository", () => {
    test("should handle complex order workflow", async () => {
      const repository = createRepository({
        entity: Order,
        schema: orderSchema,
        storage,
      });

      // Create order with items
      const order = new Order({
        body: {
          customerId: "customer-123",
          items: [
            { productId: "prod-1", quantity: 2, price: 29.99 },
            { productId: "prod-2", quantity: 1, price: 49.99 },
          ],
        },
      });

      expect(order.totalAmount).toBe(109.97);
      expect(order.status).toBe("draft");

      // Add another item
      order.addItem("prod-3", 3, 19.99);
      expect(order.totalAmount).toBe(169.94);

      // Remove an item
      order.removeItem("prod-2");
      expect(order.totalAmount).toBeCloseTo(119.95, 2);

      // Confirm order
      order.confirm("card");
      expect(order.status).toBe("confirmed");

      // Ship order
      order.ship("TRACK123", "FedEx");
      expect(order.status).toBe("shipped");

      // Deliver order
      order.markAsDelivered("John Doe");
      expect(order.status).toBe("delivered");

      // Save and retrieve
      await repository.commit(order);
      const retrievedOrder = await repository.findOne({
        entityId: order.entityId,
      });

      expect(retrievedOrder?.status).toBe("delivered");
      expect(retrievedOrder?.totalAmount).toBeCloseTo(119.95, 2);
      expect(retrievedOrder?.items.length).toBe(2);
    });

    test("should enforce business rules", async () => {
      const repository = createRepository({
        entity: Order,
        schema: orderSchema,
        storage,
      });

      const order = new Order({
        body: {
          customerId: "customer-456",
          items: [{ productId: "prod-1", quantity: 1, price: 99.99 }],
        },
      });

      // Confirm order
      order.confirm("paypal");

      // Try to add item after confirmation - should throw
      expect(() => {
        order.addItem("prod-2", 1, 49.99);
      }).toThrow("Cannot modify items in confirmed status");

      // Try to ship before saving - should work (testing business logic, not persistence)
      order.ship("SHIP456", "UPS");
      expect(order.status).toBe("shipped");

      // Try to confirm again - should throw
      expect(() => {
        order.confirm("bank");
      }).toThrow("Cannot confirm order in shipped status");

      await repository.commit(order);
    });

    test("should handle order cancellation at different stages", async () => {
      const repository = createRepository({
        entity: Order,
        schema: orderSchema,
        storage,
      });

      // Test 1: Cancel draft order
      const draftOrder = new Order({
        body: {
          customerId: "customer-789",
          items: [{ productId: "prod-1", quantity: 1, price: 50 }],
        },
      });
      draftOrder.cancel("Changed mind", "customer");
      expect(draftOrder.status).toBe("cancelled");
      await repository.commit(draftOrder);

      // Test 2: Cancel confirmed order
      const confirmedOrder = new Order({
        body: {
          customerId: "customer-790",
          items: [{ productId: "prod-2", quantity: 2, price: 75 }],
        },
      });
      confirmedOrder.confirm("card");
      confirmedOrder.cancel("Out of stock", "system");
      expect(confirmedOrder.status).toBe("cancelled");
      await repository.commit(confirmedOrder);

      // Test 3: Cannot cancel delivered order
      const deliveredOrder = new Order({
        body: {
          customerId: "customer-791",
          items: [{ productId: "prod-3", quantity: 1, price: 100 }],
        },
      });
      deliveredOrder.confirm("bank");
      deliveredOrder.ship("TRACK789", "DHL");
      deliveredOrder.markAsDelivered();

      expect(() => {
        deliveredOrder.cancel("Too late", "customer");
      }).toThrow("Cannot cancel order in delivered status");

      await repository.commit(deliveredOrder);
    });
  });

  describe("Storage Edge Cases", () => {
    test("should handle empty commits gracefully", async () => {
      const repository = createRepository({
        entity: User,
        schema: userSchema,
        storage,
      });

      const user = new User({
        body: {
          nickname: "EmptyCommitTest",
          email: "empty@test.com",
        },
      });

      // First commit with events
      await repository.commit(user);

      // Second commit without new events (should not cause issues)
      await repository.commit(user);

      const retrievedUser = await repository.findOne({
        entityId: user.entityId,
      });

      expect(retrievedUser?.nickname).toBe("EmptyCommitTest");
    });

    test("should handle concurrent entity operations", async () => {
      const repository = createRepository({
        entity: User,
        schema: userSchema,
        storage,
      });

      // Create multiple users concurrently
      const userPromises = Array.from({ length: 5 }, (_, i) =>
        (async () => {
          const user = new User({
            body: {
              nickname: `User${i}`,
              email: `user${i}@example.com`,
            },
          });
          await repository.commit(user);
          return user.entityId;
        })(),
      );

      const userIds = await Promise.all(userPromises);

      // Retrieve all users concurrently
      const retrievalPromises = userIds.map((id) =>
        repository.findOne({ entityId: id }),
      );
      const users = await Promise.all(retrievalPromises);

      // Verify all users were created and retrieved correctly
      users.forEach((user, i) => {
        expect(user?.nickname).toBe(`User${i}`);
        expect(user?.email).toBe(`user${i}@example.com`);
      });
    });

    test("should correctly isolate entities", async () => {
      const userRepository = createRepository({
        entity: User,
        schema: userSchema,
        storage,
      });

      const orderRepository = createRepository({
        entity: Order,
        schema: orderSchema,
        storage,
      });

      // Create entities with the same ID but different types
      const sharedId = "shared-id-123";

      const user = new User({
        entityId: sharedId,
        body: {
          nickname: "TestUser",
          email: "test@example.com",
        },
      });

      const order = new Order({
        entityId: sharedId,
        body: {
          customerId: "customer-999",
          items: [{ productId: "prod-1", quantity: 1, price: 99.99 }],
        },
      });

      await userRepository.commit(user);
      await orderRepository.commit(order);

      // Storage should keep them separate based on entityName
      const retrievedUser = await userRepository.findOne({
        entityId: sharedId,
      });
      const retrievedOrder = await orderRepository.findOne({
        entityId: sharedId,
      });

      expect(retrievedUser?.nickname).toBe("TestUser");
      expect(retrievedOrder?.customerId).toBe("customer-999");

      // Verify storage has both entities
      expect(storage.getEventCount("user", sharedId)).toBe(1);
      expect(storage.getEventCount("order", sharedId)).toBe(1);
    });
  });
});
