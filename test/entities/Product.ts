import { Type } from "@sinclair/typebox";
import { defineReducer, defineSchema, Entity, mutation } from "../../src";
import { typebox } from "../../src/typebox";

/**
 * Product entity schema definition using TypeBox
 * Demonstrates TypeBox integration with Ventyd
 */
export const productSchema = defineSchema("product", {
  schema: typebox({
    event: {
      created: Type.Object({
        name: Type.String({ minLength: 1, maxLength: 200 }),
        description: Type.String(),
        price: Type.Number({ minimum: 0 }),
        stock: Type.Number({ minimum: 0 }),
        category: Type.String(),
      }),
      price_updated: Type.Object({
        price: Type.Number({ minimum: 0 }),
        reason: Type.Optional(Type.String()),
      }),
      stock_adjusted: Type.Object({
        quantity: Type.Number(),
        reason: Type.String(),
      }),
      details_updated: Type.Object({
        name: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
        description: Type.Optional(Type.String()),
        category: Type.Optional(Type.String()),
      }),
      discontinued: Type.Object({
        reason: Type.String(),
        effectiveDate: Type.String(),
      }),
      reactivated: Type.Object({}),
    },
    state: Type.Object({
      name: Type.String(),
      description: Type.String(),
      price: Type.Number(),
      stock: Type.Number(),
      category: Type.String(),
      isDiscontinued: Type.Boolean(),
      discontinuedReason: Type.Optional(Type.String()),
      discontinuedAt: Type.Optional(Type.String()),
    }),
  }),
  initialEventName: "product:created",
});

/**
 * Product entity reducer
 */
export const productReducer = defineReducer(
  productSchema,
  (prevState, event) => {
    switch (event.eventName) {
      case "product:created": {
        return {
          name: event.body.name,
          description: event.body.description,
          price: event.body.price,
          stock: event.body.stock,
          category: event.body.category,
          isDiscontinued: false,
          discontinuedReason: undefined,
          discontinuedAt: undefined,
        };
      }
      case "product:price_updated": {
        return {
          ...prevState,
          price: event.body.price,
        };
      }
      case "product:stock_adjusted": {
        return {
          ...prevState,
          stock: prevState.stock + event.body.quantity,
        };
      }
      case "product:details_updated": {
        return {
          ...prevState,
          ...(event.body.name && { name: event.body.name }),
          ...(event.body.description && {
            description: event.body.description,
          }),
          ...(event.body.category && { category: event.body.category }),
        };
      }
      case "product:discontinued": {
        return {
          ...prevState,
          isDiscontinued: true,
          discontinuedReason: event.body.reason,
          discontinuedAt: event.body.effectiveDate,
        };
      }
      case "product:reactivated": {
        return {
          ...prevState,
          isDiscontinued: false,
          discontinuedReason: undefined,
          discontinuedAt: undefined,
        };
      }
      default: {
        return prevState;
      }
    }
  },
);

/**
 * Product entity class with business logic
 */
export class Product extends Entity(productSchema, productReducer) {
  // ----------------------
  // Getters
  // ----------------------
  get name() {
    return this.state.name;
  }

  get description() {
    return this.state.description;
  }

  get price() {
    return this.state.price;
  }

  get stock() {
    return this.state.stock;
  }

  get category() {
    return this.state.category;
  }

  get isDiscontinued() {
    return this.state.isDiscontinued;
  }

  get isAvailable() {
    return !this.state.isDiscontinued && this.state.stock > 0;
  }

  get canUpdatePrice() {
    return !this.state.isDiscontinued;
  }

  get canAdjustStock() {
    return !this.state.isDiscontinued;
  }

  // ----------------------
  // Business methods
  // ----------------------
  updatePrice = mutation(this, (dispatch, price: number, reason?: string) => {
    if (!this.canUpdatePrice) {
      throw new Error("Cannot update price of discontinued product");
    }

    if (price < 0) {
      throw new Error("Price cannot be negative");
    }

    const body: { price: number; reason?: string } = { price };
    if (reason !== undefined) {
      body.reason = reason;
    }

    dispatch("product:price_updated", body);
  });

  adjustStock = mutation(this, (dispatch, quantity: number, reason: string) => {
    if (!this.canAdjustStock) {
      throw new Error("Cannot adjust stock of discontinued product");
    }

    const newStock = this.state.stock + quantity;
    if (newStock < 0) {
      throw new Error(
        `Insufficient stock. Current: ${this.state.stock}, Requested: ${Math.abs(quantity)}`,
      );
    }

    dispatch("product:stock_adjusted", { quantity, reason });
  });

  updateDetails = mutation(
    this,
    (
      dispatch,
      updates: {
        name?: string;
        description?: string;
        category?: string;
      },
    ) => {
      if (this.isDiscontinued) {
        throw new Error("Cannot update details of discontinued product");
      }

      if (Object.keys(updates).length === 0) {
        throw new Error("At least one field must be updated");
      }

      dispatch("product:details_updated", updates);
    },
  );

  discontinue = mutation(this, (dispatch, reason: string) => {
    if (this.isDiscontinued) {
      throw new Error("Product is already discontinued");
    }

    dispatch("product:discontinued", {
      reason,
      effectiveDate: new Date().toISOString(),
    });
  });

  reactivate = mutation(this, (dispatch) => {
    if (!this.isDiscontinued) {
      throw new Error("Product is not discontinued");
    }

    dispatch("product:reactivated", {});
  });
}
