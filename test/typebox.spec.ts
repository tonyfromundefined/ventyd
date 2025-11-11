/** biome-ignore-all lint/style/noNonNullAssertion: for testing */
/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type Adapter, createRepository } from "../src";
import { getAllAdapterFactories } from "./adapters";
import { Product } from "./entities/Product";

/**
 * TypeBox Integration Tests
 *
 * This test suite validates the TypeBox schema provider integration with Ventyd.
 * It ensures that:
 * - TypeBox schemas are properly validated
 * - Type inference works correctly
 * - All CRUD operations work with TypeBox entities
 * - Validation constraints (min, max, format) are enforced
 */
getAllAdapterFactories().forEach((factory) => {
  describe(`TypeBox Integration with ${factory.type.toUpperCase()} Adapter`, () => {
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
      test("should create and retrieve product with TypeBox schema", async () => {
        const repository = createRepository(Product, { adapter });

        const product = Product.create({
          body: {
            name: "Laptop Pro 15",
            description: "High-performance laptop with 15-inch display",
            price: 1299.99,
            stock: 50,
            category: "Electronics",
          },
        });

        await repository.commit(product);

        const retrieved = await repository.findOne({
          entityId: product.entityId,
        });

        expect(retrieved).not.toBeNull();
        expect(retrieved?.name).toBe("Laptop Pro 15");
        expect(retrieved?.price).toBe(1299.99);
        expect(retrieved?.stock).toBe(50);
        expect(retrieved?.isDiscontinued).toBe(false);
      });

      test("should update product price", async () => {
        const repository = createRepository(Product, { adapter });

        const product = Product.create({
          body: {
            name: "Wireless Mouse",
            description: "Ergonomic wireless mouse",
            price: 29.99,
            stock: 100,
            category: "Accessories",
          },
        });

        product.updatePrice(24.99, "Holiday sale");

        await repository.commit(product);

        const retrieved = await repository.findOne({
          entityId: product.entityId,
        });

        expect(retrieved?.price).toBe(24.99);
      });

      test("should adjust product stock", async () => {
        const repository = createRepository(Product, { adapter });

        const product = Product.create({
          body: {
            name: "USB Cable",
            description: "USB-C to USB-A cable",
            price: 9.99,
            stock: 200,
            category: "Accessories",
          },
        });

        // Add stock
        product.adjustStock(50, "Restock");
        expect(product.stock).toBe(250);

        // Remove stock
        product.adjustStock(-30, "Sales");
        expect(product.stock).toBe(220);

        await repository.commit(product);

        const retrieved = await repository.findOne({
          entityId: product.entityId,
        });

        expect(retrieved?.stock).toBe(220);
      });

      test("should update product details", async () => {
        const repository = createRepository(Product, { adapter });

        const product = Product.create({
          body: {
            name: "Mechanical Keyboard",
            description: "RGB mechanical keyboard",
            price: 89.99,
            stock: 75,
            category: "Accessories",
          },
        });

        product.updateDetails({
          name: "Mechanical Gaming Keyboard",
          description: "RGB mechanical keyboard with Cherry MX switches",
          category: "Gaming",
        });

        await repository.commit(product);

        const retrieved = await repository.findOne({
          entityId: product.entityId,
        });

        expect(retrieved?.name).toBe("Mechanical Gaming Keyboard");
        expect(retrieved?.description).toBe(
          "RGB mechanical keyboard with Cherry MX switches",
        );
        expect(retrieved?.category).toBe("Gaming");
      });
    });

    describe("Business Logic Validation", () => {
      test("should enforce non-negative price constraint", () => {
        const product = Product.create({
          body: {
            name: "Test Product",
            description: "Test",
            price: 10.0,
            stock: 10,
            category: "Test",
          },
        });

        expect(() => {
          product.updatePrice(-5, "Invalid price");
        }).toThrow("Price cannot be negative");
      });

      test("should prevent stock from going negative", () => {
        const product = Product.create({
          body: {
            name: "Test Product",
            description: "Test",
            price: 10.0,
            stock: 10,
            category: "Test",
          },
        });

        expect(() => {
          product.adjustStock(-20, "Oversale");
        }).toThrow("Insufficient stock");
      });

      test("should handle product discontinuation", async () => {
        const repository = createRepository(Product, { adapter });

        const product = Product.create({
          body: {
            name: "Legacy Product",
            description: "Old model",
            price: 99.99,
            stock: 5,
            category: "Legacy",
          },
        });

        product.discontinue("End of life");

        await repository.commit(product);

        const retrieved = await repository.findOne({
          entityId: product.entityId,
        });

        expect(retrieved?.isDiscontinued).toBe(true);
        expect(retrieved?.state.discontinuedReason).toBe("End of life");
      });

      test("should prevent operations on discontinued products", async () => {
        const repository = createRepository(Product, { adapter });

        const product = Product.create({
          body: {
            name: "Discontinued Item",
            description: "No longer available",
            price: 49.99,
            stock: 0,
            category: "Discontinued",
          },
        });

        product.discontinue("Out of production");

        await repository.commit(product);

        const retrieved = await repository.findOne({
          entityId: product.entityId,
        });

        expect(() => {
          retrieved?.updatePrice(39.99, "Sale");
        }).toThrow("Cannot update price of discontinued product");

        expect(() => {
          retrieved?.adjustStock(10, "Restock");
        }).toThrow("Cannot adjust stock of discontinued product");

        expect(() => {
          retrieved?.updateDetails({ name: "New Name" });
        }).toThrow("Cannot update details of discontinued product");
      });

      test("should allow reactivating discontinued products", async () => {
        const repository = createRepository(Product, { adapter });

        const product = Product.create({
          body: {
            name: "Seasonal Product",
            description: "Back by popular demand",
            price: 59.99,
            stock: 0,
            category: "Seasonal",
          },
        });

        product.discontinue("Off season");
        product.reactivate();

        await repository.commit(product);

        const retrieved = await repository.findOne({
          entityId: product.entityId,
        });

        expect(retrieved?.isDiscontinued).toBe(false);

        // Should be able to update after reactivation
        retrieved?.updatePrice(54.99, "Welcome back sale");
        await repository.commit(retrieved!);

        const updated = await repository.findOne({
          entityId: product.entityId,
        });
        expect(updated?.price).toBe(54.99);
      });
    });

    describe("Event Sourcing Features", () => {
      test("should maintain complete event history", async () => {
        const repository = createRepository(Product, { adapter });

        const productId = "product-history-test";

        const product = Product.create({
          entityId: productId,
          body: {
            name: "Evolving Product",
            description: "Watch it change",
            price: 100.0,
            stock: 100,
            category: "Test",
          },
        });

        // Perform multiple operations
        product.updatePrice(90.0, "Price drop");
        product.adjustStock(-10, "Sale");
        product.updateDetails({ description: "Updated description" });
        product.updatePrice(95.0, "Price adjustment");

        await repository.commit(product);

        // Verify event history
        const events = await adapter.getEventsByEntityId({
          entityName: "product",
          entityId: productId,
        });

        expect(events.length).toBe(5);
        expect(events.map((e) => (e as any).eventName)).toEqual([
          "product:created",
          "product:price_updated",
          "product:stock_adjusted",
          "product:details_updated",
          "product:price_updated",
        ]);

        // Verify final state
        const retrieved = await repository.findOne({ entityId: productId });
        expect(retrieved?.price).toBe(95.0);
        expect(retrieved?.stock).toBe(90);
        expect(retrieved?.description).toBe("Updated description");
      });

      test("should reconstruct state from events", async () => {
        const repository = createRepository(Product, { adapter });

        const productId = "product-reconstruct";

        // Create and modify product
        const product = Product.create({
          entityId: productId,
          body: {
            name: "Original Name",
            description: "Original",
            price: 50.0,
            stock: 20,
            category: "Original",
          },
        });

        product.updateDetails({
          name: "Updated Name",
          description: "Updated",
        });
        product.adjustStock(30, "Restock");
        product.updatePrice(45.0, "Discount");

        await repository.commit(product);

        // Retrieve and verify state is reconstructed correctly
        const retrieved = await repository.findOne({ entityId: productId });

        expect(retrieved?.name).toBe("Updated Name");
        expect(retrieved?.description).toBe("Updated");
        expect(retrieved?.price).toBe(45.0);
        expect(retrieved?.stock).toBe(50);
      });
    });

    describe("TypeBox-Specific Features", () => {
      test("should work with TypeBox validation constraints", () => {
        // TypeBox's minimum constraint for price (must be >= 0)
        // TypeBox's minimum constraint for stock (must be >= 0)
        // TypeBox's string length constraints (name: minLength 1, maxLength 200)

        const product = Product.create({
          body: {
            name: "Valid Product",
            description: "This has valid constraints",
            price: 0, // Minimum allowed value
            stock: 0, // Minimum allowed value
            category: "Test",
          },
        });

        expect(product.price).toBe(0);
        expect(product.stock).toBe(0);
      });

      test("should handle optional fields correctly", async () => {
        const repository = createRepository(Product, { adapter });

        const product = Product.create({
          body: {
            name: "Product",
            description: "Description",
            price: 10.0,
            stock: 10,
            category: "Test",
          },
        });

        // Update price without reason (optional field)
        product.updatePrice(15.0);

        await repository.commit(product);

        const retrieved = await repository.findOne({
          entityId: product.entityId,
        });

        expect(retrieved?.price).toBe(15.0);
      });

      test("should work with nested TypeBox objects", async () => {
        const repository = createRepository(Product, { adapter });

        const product = Product.create({
          body: {
            name: "Complex Product",
            description: "Has complex structure",
            price: 100.0,
            stock: 50,
            category: "Electronics",
          },
        });

        // The discontinued event has nested structure
        product.discontinue("Complex reason with detailed info");

        await repository.commit(product);

        const retrieved = await repository.findOne({
          entityId: product.entityId,
        });

        expect(retrieved?.isDiscontinued).toBe(true);
        expect(retrieved?.state.discontinuedReason).toBe(
          "Complex reason with detailed info",
        );
        expect(retrieved?.state.discontinuedAt).toBeDefined();
      });
    });

    describe("Concurrent Operations", () => {
      test("should handle multiple products concurrently", async () => {
        const repository = createRepository(Product, { adapter });

        const products = await Promise.all(
          Array.from({ length: 5 }, async (_, i) => {
            const product = Product.create({
              body: {
                name: `Product ${i}`,
                description: `Description ${i}`,
                price: (i + 1) * 10,
                stock: (i + 1) * 5,
                category: `Category ${i % 3}`,
              },
            });

            await repository.commit(product);
            return product.entityId;
          }),
        );

        // Verify all products were created
        expect(products.length).toBe(5);

        const retrieved = await Promise.all(
          products.map((id) => repository.findOne({ entityId: id })),
        );

        retrieved.forEach((product, i) => {
          expect(product).not.toBeNull();
          expect(product?.name).toBe(`Product ${i}`);
        });
      });
    });
  });
});
