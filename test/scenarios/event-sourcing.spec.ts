import { describe, test, expect, beforeEach } from "vitest";
import { createRepository } from "../../src/createRepository";
import { InMemoryStorage } from "../storages/InMemoryStorage";
import { User, userSchema } from "../entities/User";
import { Order, orderSchema } from "../entities/Order";
import type { Plugin } from "../../src/Plugin";

describe("Event Sourcing Scenarios", () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  describe("Time Travel and Event Replay", () => {
    test("should rebuild state from event history", async () => {
      const repository = createRepository({
        entity: User,
        schema: userSchema,
        storage,
      });

      // Simulate a user's lifecycle over time
      const userId = "user-timeline";
      
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

      // Now, let's replay the entire history
      const finalUser = await repository.findOne({ entityId: userId });
      
      expect(finalUser?.nickname).toBe("TimeTraveler");
      expect(finalUser?.bio).toBe("Exploring event sourcing");
      expect(finalUser?.isDeleted).toBe(false);
      
      // Verify complete event history
      const allEvents = storage.getAllEvents();
      expect(allEvents.length).toBe(4);
      expect(allEvents.map(e => (e as any).eventName)).toEqual([
        "user:created",
        "user:profileUpdated",
        "user:deleted",
        "user:restored",
      ]);
    });

    test("should handle event versioning and migration scenario", async () => {
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
            // Note: old events might not have all fields
          },
        },
        {
          eventId: "old-2",
          eventName: "user:profileUpdated",
          eventCreatedAt: "2023-06-01T00:00:00Z",
          entityId: "legacy-user",
          entityName: "user",
          body: {
            // Partial update
            bio: "Migrated from v1",
          },
        },
      ];

      // Store old events directly (cast as proper type)
      await storage.commitEvents({ events: oldEvents as any });

      // Load with new entity version
      const repository = createRepository({
        entity: User,
        schema: userSchema,
        storage,
      });

      const migratedUser = await repository.findOne({ 
        entityId: "legacy-user" 
      });

      expect(migratedUser?.nickname).toBe("LegacyUser");
      expect(migratedUser?.email).toBe("legacy@old.com");
      expect(migratedUser?.bio).toBe("Migrated from v1");
    });
  });

  describe("Compensating Transactions", () => {
    test("should handle order cancellation as compensating event", async () => {
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
        entityId: order.entityId 
      });
      fraudOrder?.cancel("Fraudulent transaction detected", "system");
      await repository.commit(fraudOrder!);

      // Verify compensation
      const finalOrder = await repository.findOne({ 
        entityId: order.entityId 
      });
      expect(finalOrder?.status).toBe("cancelled");
      expect(finalOrder?.state.cancelReason).toBe("Fraudulent transaction detected");

      // All original events are preserved
      const events = storage.getAllEvents();
      expect(events.length).toBe(4); // created, confirmed, shipped, cancelled
    });
  });

  describe("Event Sourcing with Plugins", () => {
    test("should trigger plugins for audit logging", async () => {
      const auditLog: Array<{ entity: any; events: any[] }> = [];

      const auditPlugin = {
        async onCommited({ entity, events }: { entity: User; events: any[] }) {
          auditLog.push({
            entity: {
              id: entity.entityId,
              name: entity.nickname,
              timestamp: new Date().toISOString(),
            },
            events: events.map(e => ({
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

      // Check audit log
      expect(auditLog.length).toBe(1);
      expect(auditLog[0]?.entity.name).toBe("AuditedUser");
      expect(auditLog[0]?.events.length).toBe(2);
      expect(auditLog[0]?.events[0]?.type).toBe("user:created");
      expect(auditLog[0]?.events[1]?.type).toBe("user:profileUpdated");
    });

    test("should handle multiple plugins in sequence", async () => {
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

  describe("Complex Business Scenarios", () => {
    test("should handle shopping cart abandonment and recovery", async () => {
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

      // Simulate cart recovery after 24 hours
      const recoveredCart = await orderRepo.findOne({ 
        entityId: "cart-001" 
      });
      
      // Customer removes expensive items
      recoveredCart?.removeItem("laptop");
      recoveredCart?.removeItem("monitor");
      
      // And completes purchase with remaining items
      recoveredCart?.confirm("paypal");
      await orderRepo.commit(recoveredCart!);

      // Verify final state
      const finalOrder = await orderRepo.findOne({ 
        entityId: "cart-001" 
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
      const finalUser = await userRepo.findOne({ entityId: "lifecycle-user" });
      expect(finalUser?.nickname).toBe("JohnTheArchitect");
      expect(finalUser?.bio).toBe("Back and ready to code! Senior Architect now.");
      expect(finalUser?.isDeleted).toBe(false);

      // Check event count
      const eventCount = storage.getEventCount("user", "lifecycle-user");
      expect(eventCount).toBe(6); // created, updated x3, deleted, restored
    });

    test("should handle concurrent order processing", async () => {
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
                price: (i + 1) * 10 
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
      expect(order0?.status).toBe("shipped"); // 0 is divisible by 3 (takes first branch)

      const order2 = await orderRepo.findOne({ entityId: orderIds[2]! });
      expect(order2?.status).toBe("confirmed"); // 2 is divisible by 2 but not 3

      const order3 = await orderRepo.findOne({ entityId: orderIds[3]! });
      expect(order3?.status).toBe("shipped"); // 3 is divisible by 3

      const order9 = await orderRepo.findOne({ entityId: orderIds[9]! });
      expect(order9?.status).toBe("delivered"); // Special case (9 is divisible by 3, so gets shipped, then delivered)
    });
  });

  describe("Event Ordering and Consistency", () => {
    test("should maintain event order within entity", async () => {
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

      // Retrieve and verify
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

    test("should handle state reconstruction correctly", async () => {
      // Directly insert events in specific order
      const events = [
        {
          eventId: "evt-a",
          eventName: "order:created",
          eventCreatedAt: "2024-01-01T10:00:00Z",
          entityId: "order-reconstruct",
          entityName: "order",
          body: {
            customerId: "cust-recon",
            items: [
              { productId: "A", quantity: 1, price: 100 },
            ],
          },
        },
        {
          eventId: "evt-b",
          eventName: "order:itemAdded",
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
          eventId: "evt-c",
          eventName: "order:itemRemoved",
          eventCreatedAt: "2024-01-01T12:00:00Z",
          entityId: "order-reconstruct",
          entityName: "order",
          body: {
            productId: "A",
          },
        },
        {
          eventId: "evt-d",
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
        entityId: "order-reconstruct" 
      });

      // Verify final state after all events
      expect(reconstructed?.items.length).toBe(1);
      expect(reconstructed?.items[0]?.productId).toBe("B");
      expect(reconstructed?.totalAmount).toBe(100); // 2 * 50
      expect(reconstructed?.status).toBe("confirmed");
    });
  });
});