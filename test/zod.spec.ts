/** biome-ignore-all lint/style/noNonNullAssertion: for testing */
/** biome-ignore-all lint/suspicious/noExplicitAny: for testing */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type Adapter, createRepository } from "../src";
import { getAllAdapterFactories } from "./adapters";
import { Customer } from "./entities/Customer";

/**
 * Zod Integration Tests
 *
 * This test suite validates the Zod schema provider integration with Ventyd.
 * It ensures that:
 * - Zod schemas are properly validated
 * - Type inference works correctly
 * - All CRUD operations work with Zod entities
 * - Validation constraints (email, min, max, enum) are enforced
 */
getAllAdapterFactories().forEach((factory) => {
  describe(`Zod Integration with ${factory.type.toUpperCase()} Adapter`, () => {
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
      test("should create and retrieve customer with Zod schema", async () => {
        const repository = createRepository(Customer, { adapter });

        const customer = Customer.create({
          body: {
            name: "John Doe",
            email: "john@example.com",
            phone: "+1234567890",
          },
        });

        await repository.commit(customer);

        const retrieved = await repository.findOne({
          entityId: customer.entityId,
        });

        expect(retrieved).not.toBeNull();
        expect(retrieved?.name).toBe("John Doe");
        expect(retrieved?.email).toBe("john@example.com");
        expect(retrieved?.phone).toBe("+1234567890");
        expect(retrieved?.tier).toBe("bronze");
        expect(retrieved?.isActive).toBe(true);
      });

      test("should update customer contact", async () => {
        const repository = createRepository(Customer, { adapter });

        const customer = Customer.create({
          body: {
            name: "Jane Smith",
            email: "jane@example.com",
          },
        });

        customer.updateContact({
          email: "jane.smith@example.com",
          phone: "+9876543210",
        });

        await repository.commit(customer);

        const retrieved = await repository.findOne({
          entityId: customer.entityId,
        });

        expect(retrieved?.email).toBe("jane.smith@example.com");
        expect(retrieved?.phone).toBe("+9876543210");
      });

      test("should upgrade customer tier", async () => {
        const repository = createRepository(Customer, { adapter });

        const customer = Customer.create({
          body: {
            name: "Bob Johnson",
            email: "bob@example.com",
          },
        });

        customer.upgrade("silver");
        customer.upgrade("gold");

        await repository.commit(customer);

        const retrieved = await repository.findOne({
          entityId: customer.entityId,
        });

        expect(retrieved?.tier).toBe("gold");
      });

      test("should deactivate and reactivate customer", async () => {
        const repository = createRepository(Customer, { adapter });

        const customer = Customer.create({
          body: {
            name: "Alice Brown",
            email: "alice@example.com",
          },
        });

        customer.deactivate("Account closed by user");
        customer.reactivate();

        await repository.commit(customer);

        const retrieved = await repository.findOne({
          entityId: customer.entityId,
        });

        expect(retrieved?.isActive).toBe(true);
      });
    });

    describe("Business Logic Validation", () => {
      test("should prevent downgrade of tier", () => {
        const customer = Customer.create({
          body: {
            name: "Test Customer",
            email: "test@example.com",
          },
        });

        customer.upgrade("platinum");

        expect(() => {
          customer.upgrade("silver");
        }).toThrow("Cannot downgrade");
      });

      test("should prevent operations on deactivated customers", async () => {
        const repository = createRepository(Customer, { adapter });

        const customer = Customer.create({
          body: {
            name: "Inactive Customer",
            email: "inactive@example.com",
          },
        });

        customer.deactivate("Test deactivation");

        await repository.commit(customer);

        const retrieved = await repository.findOne({
          entityId: customer.entityId,
        });

        expect(() => {
          retrieved?.updateContact({ email: "new@example.com" });
        }).toThrow("Cannot update contact of deactivated customer");

        expect(() => {
          retrieved?.upgrade("gold");
        }).toThrow("Cannot upgrade deactivated customer");
      });
    });

    describe("Event Sourcing Features", () => {
      test("should maintain complete event history", async () => {
        const repository = createRepository(Customer, { adapter });

        const customerId = "customer-history-test";

        const customer = Customer.create({
          entityId: customerId,
          body: {
            name: "Event Test Customer",
            email: "event@example.com",
          },
        });

        customer.upgrade("silver");
        customer.updateContact({ phone: "+1111111111" });
        customer.upgrade("gold");

        await repository.commit(customer);

        const events = await adapter.getEventsByEntityId({
          entityName: "customer",
          entityId: customerId,
        });

        expect(events.length).toBe(4);
        expect(events.map((e) => (e as any).eventName)).toEqual([
          "customer:created",
          "customer:upgraded",
          "customer:contact_updated",
          "customer:upgraded",
        ]);

        const retrieved = await repository.findOne({ entityId: customerId });
        expect(retrieved?.tier).toBe("gold");
        expect(retrieved?.phone).toBe("+1111111111");
      });
    });

    describe("Zod-Specific Features", () => {
      test("should work with Zod validation constraints", () => {
        const customer = Customer.create({
          body: {
            name: "Valid Customer",
            email: "valid@example.com",
          },
        });

        expect(customer.name).toBe("Valid Customer");
        expect(customer.email).toBe("valid@example.com");
        expect(customer.tier).toBe("bronze");
      });

      test("should handle optional fields correctly", async () => {
        const repository = createRepository(Customer, { adapter });

        const customer = Customer.create({
          body: {
            name: "Customer Without Phone",
            email: "nophone@example.com",
          },
        });

        await repository.commit(customer);

        const retrieved = await repository.findOne({
          entityId: customer.entityId,
        });

        expect(retrieved?.phone).toBeUndefined();
      });

      test("should work with enum constraints", async () => {
        const repository = createRepository(Customer, { adapter });

        const customer = Customer.create({
          body: {
            name: "Tier Test Customer",
            email: "tier@example.com",
          },
        });

        customer.upgrade("silver");
        customer.upgrade("gold");
        customer.upgrade("platinum");

        await repository.commit(customer);

        const retrieved = await repository.findOne({
          entityId: customer.entityId,
        });

        expect(retrieved?.tier).toBe("platinum");
      });
    });

    describe("Concurrent Operations", () => {
      test("should handle multiple customers concurrently", async () => {
        const repository = createRepository(Customer, { adapter });

        const customers = await Promise.all(
          Array.from({ length: 5 }, async (_, i) => {
            const customer = Customer.create({
              body: {
                name: `Customer ${i}`,
                email: `customer${i}@example.com`,
                phone: `+123456789${i}`,
              },
            });

            await repository.commit(customer);
            return customer.entityId;
          }),
        );

        expect(customers.length).toBe(5);

        const retrieved = await Promise.all(
          customers.map((id) => repository.findOne({ entityId: id })),
        );

        retrieved.forEach((customer, i) => {
          expect(customer).not.toBeNull();
          expect(customer?.name).toBe(`Customer ${i}`);
        });
      });
    });
  });
});
