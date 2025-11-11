import * as v from "valibot";
import { defineReducer, defineSchema, Entity, mutation } from "../../src";
import { valibot } from "../../src/valibot";

/**
 * Order entity schema definition (for e-commerce use case)
 */
export const orderSchema = defineSchema("order", {
  schema: valibot({
    event: {
      created: v.object({
        customerId: v.string(),
        items: v.array(
          v.object({
            productId: v.string(),
            quantity: v.number(),
            price: v.number(),
          }),
        ),
      }),
      item_added: v.object({
        productId: v.string(),
        quantity: v.number(),
        price: v.number(),
      }),
      item_removed: v.object({
        productId: v.string(),
      }),
      confirmed: v.object({
        paymentMethod: v.picklist(["card", "paypal", "bank"]),
      }),
      shipped: v.object({
        trackingNumber: v.string(),
        carrier: v.string(),
      }),
      delivered: v.object({
        deliveredAt: v.string(),
        signature: v.optional(v.string()),
      }),
      cancelled: v.object({
        reason: v.string(),
        cancelledBy: v.picklist(["customer", "system", "admin"]),
      }),
    },
    state: v.object({
      customerId: v.string(),
      items: v.array(
        v.object({
          productId: v.string(),
          quantity: v.number(),
          price: v.number(),
        }),
      ),
      status: v.picklist([
        "draft",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
      ]),
      totalAmount: v.number(),
      paymentMethod: v.optional(v.picklist(["card", "paypal", "bank"])),
      shipping: v.optional(
        v.object({
          trackingNumber: v.string(),
          carrier: v.string(),
        }),
      ),
      deliveredAt: v.optional(v.string()),
      cancelReason: v.optional(v.string()),
    }),
  }),
  initialEventName: "order:created",
});

/**
 * Order entity reducer
 */
export const orderReducer = defineReducer(orderSchema, (prevState, event) => {
  switch (event.eventName) {
    case "order:created": {
      const totalAmount = event.body.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      return {
        customerId: event.body.customerId,
        items: event.body.items,
        status: "draft" as const,
        totalAmount,
        paymentMethod: undefined,
        shipping: undefined,
        deliveredAt: undefined,
        cancelReason: undefined,
      };
    }
    case "order:item_added": {
      const newItem = {
        productId: event.body.productId,
        quantity: event.body.quantity,
        price: event.body.price,
      };
      const existingItemIndex = prevState.items.findIndex(
        (item) => item.productId === event.body.productId,
      );

      let updatedItems = [];

      if (existingItemIndex >= 0) {
        updatedItems = [...prevState.items];
        const existingItem = updatedItems[existingItemIndex];
        if (existingItem) {
          existingItem.quantity += event.body.quantity;
        }
      } else {
        updatedItems = [...prevState.items, newItem];
      }

      const totalAmount = updatedItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      return {
        ...prevState,
        items: updatedItems,
        totalAmount,
      };
    }
    case "order:item_removed": {
      const updatedItems = prevState.items.filter(
        (item) => item.productId !== event.body.productId,
      );
      const totalAmount = updatedItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      return {
        ...prevState,
        items: updatedItems,
        totalAmount,
      };
    }
    case "order:confirmed": {
      return {
        ...prevState,
        status: "confirmed" as const,
        paymentMethod: event.body.paymentMethod,
      };
    }
    case "order:shipped": {
      return {
        ...prevState,
        status: "shipped" as const,
        shipping: {
          trackingNumber: event.body.trackingNumber,
          carrier: event.body.carrier,
        },
      };
    }
    case "order:delivered": {
      return {
        ...prevState,
        status: "delivered" as const,
        deliveredAt: event.body.deliveredAt,
      };
    }
    case "order:cancelled": {
      return {
        ...prevState,
        status: "cancelled" as const,
        cancelReason: event.body.reason,
      };
    }
    default: {
      return prevState;
    }
  }
});

/**
 * Order entity class with business logic
 */
export class Order extends Entity(orderSchema, orderReducer) {
  // ----------------------
  // Getters
  // ----------------------
  get customerId() {
    return this.state.customerId;
  }

  get items() {
    return this.state.items;
  }

  get status() {
    return this.state.status;
  }

  get totalAmount() {
    return this.state.totalAmount;
  }

  get canModifyItems() {
    return this.state.status === "draft";
  }

  get canShip() {
    return this.state.status === "confirmed";
  }

  get canDeliver() {
    return this.state.status === "shipped";
  }

  // ----------------------
  // Business methods
  // ----------------------
  addItem = mutation(
    this,
    (dispatch, productId: string, quantity: number, price: number) => {
      if (!this.canModifyItems) {
        throw new Error(`Cannot modify items in ${this.state.status} status`);
      }

      dispatch("order:item_added", { productId, quantity, price });
    },
  );

  removeItem = mutation(this, (dispatch, productId: string) => {
    if (!this.canModifyItems) {
      throw new Error(`Cannot modify items in ${this.state.status} status`);
    }

    const item = this.state.items.find((i) => i.productId === productId);
    if (!item) {
      throw new Error(`Item ${productId} not found in order`);
    }

    dispatch("order:item_removed", { productId });
  });

  confirm = mutation(
    this,
    (dispatch, paymentMethod: "card" | "paypal" | "bank") => {
      if (this.state.status !== "draft") {
        throw new Error(`Cannot confirm order in ${this.state.status} status`);
      }

      if (this.state.items.length === 0) {
        throw new Error("Cannot confirm order with no items");
      }

      dispatch("order:confirmed", { paymentMethod });
    },
  );

  ship = mutation(this, (dispatch, trackingNumber: string, carrier: string) => {
    if (!this.canShip) {
      throw new Error(`Cannot ship order in ${this.state.status} status`);
    }

    dispatch("order:shipped", { trackingNumber, carrier });
  });

  markAsDelivered = mutation(this, (dispatch, signature?: string) => {
    if (!this.canDeliver) {
      throw new Error(`Cannot deliver order in ${this.state.status} status`);
    }

    dispatch("order:delivered", {
      deliveredAt: new Date().toISOString(),
      signature,
    });
  });

  cancel = mutation(
    this,
    (
      dispatch,
      reason: string,
      cancelledBy: "customer" | "system" | "admin",
    ) => {
      if (
        this.state.status === "delivered" ||
        this.state.status === "cancelled"
      ) {
        throw new Error(`Cannot cancel order in ${this.state.status} status`);
      }

      dispatch("order:cancelled", { reason, cancelledBy });
    },
  );
}
