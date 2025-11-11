import { z } from "zod";
import { defineReducer, defineSchema, Entity, mutation } from "../../src";
import { zod } from "../../src/zod";

/**
 * Customer entity schema definition using Zod
 * Demonstrates Zod integration with Ventyd
 */
export const customerSchema = defineSchema("customer", {
  schema: zod({
    event: {
      created: z.object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        phone: z.string().optional(),
      }),
      contact_updated: z.object({
        email: z.string().email().optional(),
        phone: z.string().optional(),
      }),
      upgraded: z.object({
        tier: z.enum(["bronze", "silver", "gold", "platinum"]),
      }),
      deactivated: z.object({
        reason: z.string(),
      }),
      reactivated: z.object({}),
    },
    state: z.object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      tier: z.enum(["bronze", "silver", "gold", "platinum"]),
      isActive: z.boolean(),
      deactivatedReason: z.string().optional(),
    }),
  }),
  initialEventName: "customer:created",
});

/**
 * Customer entity reducer
 */
export const customerReducer = defineReducer(
  customerSchema,
  (prevState, event) => {
    switch (event.eventName) {
      case "customer:created": {
        return {
          name: event.body.name,
          email: event.body.email,
          phone: event.body.phone,
          tier: "bronze" as const,
          isActive: true,
          deactivatedReason: undefined,
        };
      }
      case "customer:contact_updated": {
        return {
          ...prevState,
          ...(event.body.email && { email: event.body.email }),
          ...(event.body.phone !== undefined && { phone: event.body.phone }),
        };
      }
      case "customer:upgraded": {
        return {
          ...prevState,
          tier: event.body.tier,
        };
      }
      case "customer:deactivated": {
        return {
          ...prevState,
          isActive: false,
          deactivatedReason: event.body.reason,
        };
      }
      case "customer:reactivated": {
        return {
          ...prevState,
          isActive: true,
          deactivatedReason: undefined,
        };
      }
      default: {
        return prevState;
      }
    }
  },
);

/**
 * Customer entity class with business logic
 */
export class Customer extends Entity(customerSchema, customerReducer) {
  // ----------------------
  // Getters
  // ----------------------
  get name() {
    return this.state.name;
  }

  get email() {
    return this.state.email;
  }

  get phone() {
    return this.state.phone;
  }

  get tier() {
    return this.state.tier;
  }

  get isActive() {
    return this.state.isActive;
  }

  // ----------------------
  // Business methods
  // ----------------------
  updateContact = mutation(
    this,
    (dispatch, updates: { email?: string; phone?: string }) => {
      if (!this.isActive) {
        throw new Error("Cannot update contact of deactivated customer");
      }

      if (Object.keys(updates).length === 0) {
        throw new Error("At least one field must be updated");
      }

      dispatch("customer:contact_updated", updates);
    },
  );

  upgrade = mutation(
    this,
    (dispatch, tier: "bronze" | "silver" | "gold" | "platinum") => {
      if (!this.isActive) {
        throw new Error("Cannot upgrade deactivated customer");
      }

      const tierLevels = ["bronze", "silver", "gold", "platinum"];
      const currentLevel = tierLevels.indexOf(this.state.tier);
      const newLevel = tierLevels.indexOf(tier);

      if (newLevel <= currentLevel) {
        throw new Error(`Cannot downgrade from ${this.state.tier} to ${tier}`);
      }

      dispatch("customer:upgraded", { tier });
    },
  );

  deactivate = mutation(this, (dispatch, reason: string) => {
    if (!this.isActive) {
      throw new Error("Customer is already deactivated");
    }

    dispatch("customer:deactivated", { reason });
  });

  reactivate = mutation(this, (dispatch) => {
    if (this.isActive) {
      throw new Error("Customer is already active");
    }

    dispatch("customer:reactivated", {});
  });
}
