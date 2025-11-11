/** biome-ignore-all lint/style/noNonNullAssertion: for testing */
/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type Adapter, createRepository } from "../src";
import { getAllAdapterFactories } from "./adapters";
import { Inventory } from "./entities/Inventory";

/**
 * ArkType Integration Tests
 *
 * This test suite validates the ArkType schema provider integration with Ventyd.
 * It ensures that:
 * - ArkType schemas are properly validated
 * - Type inference works correctly
 * - All CRUD operations work with ArkType entities
 * - Validation constraints (string, number ranges) are enforced
 */
getAllAdapterFactories().forEach((factory) => {
  describe(`ArkType Integration with ${factory.type.toUpperCase()} Adapter`, () => {
    let adapter: Adapter;

    beforeEach(async () => {
      adapter = await factory.create();
    });

    afterEach(async () => {
      if (factory.cleanup) {
        await factory.cleanup();
      }
    });

    describe("Basic Operations", () => {
      test("should create and retrieve inventory with ArkType schema", async () => {
        const repository = createRepository(Inventory, { adapter });

        const inventory = Inventory.create({
          body: {
            itemName: "Laptop Battery",
            sku: "LB-12345",
            quantity: 100,
            location: "Warehouse A",
          },
        });

        await repository.commit(inventory);

        const retrieved = await repository.findOne({
          entityId: inventory.entityId,
        });

        expect(retrieved).not.toBeNull();
        expect(retrieved?.itemName).toBe("Laptop Battery");
        expect(retrieved?.sku).toBe("LB-12345");
        expect(retrieved?.quantity).toBe(100);
        expect(retrieved?.location).toBe("Warehouse A");
        expect(retrieved?.isDepleted).toBe(false);
      });

      test("should adjust inventory quantity", async () => {
        const repository = createRepository(Inventory, { adapter });

        const inventory = Inventory.create({
          body: {
            itemName: "USB Cable",
            sku: "USB-001",
            quantity: 200,
            location: "Shelf B2",
          },
        });

        inventory.adjustQuantity(50, "Restock");
        inventory.adjustQuantity(-30, "Sales");

        await repository.commit(inventory);

        const retrieved = await repository.findOne({
          entityId: inventory.entityId,
        });

        expect(retrieved?.quantity).toBe(220);
      });

      test("should change inventory location", async () => {
        const repository = createRepository(Inventory, { adapter });

        const inventory = Inventory.create({
          body: {
            itemName: "Monitor",
            sku: "MON-24",
            quantity: 50,
            location: "Warehouse A",
          },
        });

        inventory.changeLocation("Warehouse B");

        await repository.commit(inventory);

        const retrieved = await repository.findOne({
          entityId: inventory.entityId,
        });

        expect(retrieved?.location).toBe("Warehouse B");
      });

      test("should update inventory details", async () => {
        const repository = createRepository(Inventory, { adapter });

        const inventory = Inventory.create({
          body: {
            itemName: "Keyboard",
            sku: "KB-OLD",
            quantity: 75,
            location: "Storage",
          },
        });

        inventory.updateDetails({
          itemName: "Mechanical Keyboard",
          sku: "KB-NEW",
        });

        await repository.commit(inventory);

        const retrieved = await repository.findOne({
          entityId: inventory.entityId,
        });

        expect(retrieved?.itemName).toBe("Mechanical Keyboard");
        expect(retrieved?.sku).toBe("KB-NEW");
      });
    });

    describe("Business Logic Validation", () => {
      test("should prevent negative quantity", () => {
        const inventory = Inventory.create({
          body: {
            itemName: "Test Item",
            sku: "TEST-001",
            quantity: 10,
            location: "Test",
          },
        });

        expect(() => {
          inventory.adjustQuantity(-20, "Oversale");
        }).toThrow("Insufficient quantity");
      });

      test("should prevent operations on depleted inventory", async () => {
        const repository = createRepository(Inventory, { adapter });

        const inventory = Inventory.create({
          body: {
            itemName: "Depleted Item",
            sku: "DEP-001",
            quantity: 0,
            location: "Storage",
          },
        });

        inventory.markAsDepleted("Out of stock");

        await repository.commit(inventory);

        const retrieved = await repository.findOne({
          entityId: inventory.entityId,
        });

        expect(retrieved?.isDepleted).toBe(true);

        expect(() => {
          retrieved?.adjustQuantity(10, "Restock");
        }).toThrow("Cannot adjust quantity of depleted inventory");

        expect(() => {
          retrieved?.changeLocation("New Location");
        }).toThrow("Cannot change location of depleted inventory");

        expect(() => {
          retrieved?.updateDetails({ itemName: "New Name" });
        }).toThrow("Cannot update details of depleted inventory");
      });

      test("should allow restocking depleted inventory", async () => {
        const repository = createRepository(Inventory, { adapter });

        const inventory = Inventory.create({
          body: {
            itemName: "Restockable Item",
            sku: "RS-001",
            quantity: 0,
            location: "Warehouse",
          },
        });

        inventory.markAsDepleted("Temporary shortage");
        inventory.restock();

        await repository.commit(inventory);

        const retrieved = await repository.findOne({
          entityId: inventory.entityId,
        });

        expect(retrieved?.isDepleted).toBe(false);

        // Should be able to update after restocking
        retrieved?.adjustQuantity(50, "New stock arrived");
        await repository.commit(retrieved!);

        const updated = await repository.findOne({
          entityId: inventory.entityId,
        });
        expect(updated?.quantity).toBe(50);
      });
    });

    describe("Event Sourcing Features", () => {
      test("should maintain complete event history", async () => {
        const repository = createRepository(Inventory, { adapter });

        const inventoryId = "inventory-history-test";

        const inventory = Inventory.create({
          entityId: inventoryId,
          body: {
            itemName: "Evolving Item",
            sku: "EV-001",
            quantity: 100,
            location: "Warehouse A",
          },
        });

        inventory.adjustQuantity(50, "Restock");
        inventory.changeLocation("Warehouse B");
        inventory.updateDetails({ itemName: "Updated Item" });
        inventory.adjustQuantity(-30, "Sales");

        await repository.commit(inventory);

        const events = await adapter.getEventsByEntityId({
          entityName: "inventory",
          entityId: inventoryId,
        });

        expect(events.length).toBe(5);
        expect(events.map((e) => (e as any).eventName)).toEqual([
          "inventory:created",
          "inventory:quantity_adjusted",
          "inventory:location_changed",
          "inventory:details_updated",
          "inventory:quantity_adjusted",
        ]);

        const retrieved = await repository.findOne({ entityId: inventoryId });
        expect(retrieved?.quantity).toBe(120);
        expect(retrieved?.location).toBe("Warehouse B");
        expect(retrieved?.itemName).toBe("Updated Item");
      });

      test("should reconstruct state from events", async () => {
        const repository = createRepository(Inventory, { adapter });

        const inventoryId = "inventory-reconstruct";

        const inventory = Inventory.create({
          entityId: inventoryId,
          body: {
            itemName: "Original Item",
            sku: "ORIG-001",
            quantity: 50,
            location: "Location A",
          },
        });

        inventory.updateDetails({
          itemName: "Updated Item",
          sku: "NEW-001",
        });
        inventory.adjustQuantity(25, "Restock");
        inventory.changeLocation("Location B");

        await repository.commit(inventory);

        const retrieved = await repository.findOne({ entityId: inventoryId });

        expect(retrieved?.itemName).toBe("Updated Item");
        expect(retrieved?.sku).toBe("NEW-001");
        expect(retrieved?.quantity).toBe(75);
        expect(retrieved?.location).toBe("Location B");
      });
    });

    describe("ArkType-Specific Features", () => {
      test("should work with ArkType validation constraints", () => {
        const inventory = Inventory.create({
          body: {
            itemName: "Valid Item",
            sku: "VALID-001",
            quantity: 0, // Minimum allowed (number>=0)
            location: "Test Location",
          },
        });

        expect(inventory.quantity).toBe(0);
      });

      test("should handle optional fields correctly", async () => {
        const repository = createRepository(Inventory, { adapter });

        const inventory = Inventory.create({
          body: {
            itemName: "Simple Item",
            sku: "SIMPLE-001",
            quantity: 10,
            location: "Storage",
          },
        });

        await repository.commit(inventory);

        const retrieved = await repository.findOne({
          entityId: inventory.entityId,
        });

        expect(retrieved?.depletedReason).toBeUndefined();
      });

      test("should work with string literal types", async () => {
        const repository = createRepository(Inventory, { adapter });

        const inventory = Inventory.create({
          body: {
            itemName: "Item with Type",
            sku: "TYPE-001",
            quantity: 100,
            location: "Warehouse",
          },
        });

        inventory.markAsDepleted("Seasonal item - off season");

        await repository.commit(inventory);

        const retrieved = await repository.findOne({
          entityId: inventory.entityId,
        });

        expect(retrieved?.isDepleted).toBe(true);
        expect(retrieved?.state.depletedReason).toBe(
          "Seasonal item - off season",
        );
      });
    });

    describe("Concurrent Operations", () => {
      test("should handle multiple inventory items concurrently", async () => {
        const repository = createRepository(Inventory, { adapter });

        const items = await Promise.all(
          Array.from({ length: 5 }, async (_, i) => {
            const inventory = Inventory.create({
              body: {
                itemName: `Item ${i}`,
                sku: `SKU-${i}`,
                quantity: (i + 1) * 10,
                location: `Location ${i}`,
              },
            });

            await repository.commit(inventory);
            return inventory.entityId;
          }),
        );

        expect(items.length).toBe(5);

        const retrieved = await Promise.all(
          items.map((id) => repository.findOne({ entityId: id })),
        );

        retrieved.forEach((item, i) => {
          expect(item).not.toBeNull();
          expect(item?.itemName).toBe(`Item ${i}`);
          expect(item?.quantity).toBe((i + 1) * 10);
        });
      });
    });
  });
});
