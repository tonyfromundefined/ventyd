import { z } from "zod";
import { defineSchema } from "../../src/defineSchema";
import { defineReducer } from "../../src/defineReducer";
import { Entity } from "../../src/Entity";

/**
 * Order entity schema definition (for e-commerce use case)
 */
export const orderSchema = defineSchema("order", {
  event: {
    created: z.object({
      customerId: z.string(),
      items: z.array(
        z.object({
          productId: z.string(),
          quantity: z.number().positive(),
          price: z.number().positive(),
        }),
      ),
    }),
    itemAdded: z.object({
      productId: z.string(),
      quantity: z.number().positive(),
      price: z.number().positive(),
    }),
    itemRemoved: z.object({
      productId: z.string(),
    }),
    confirmed: z.object({
      paymentMethod: z.enum(["card", "paypal", "bank"]),
    }),
    shipped: z.object({
      trackingNumber: z.string(),
      carrier: z.string(),
    }),
    delivered: z.object({
      deliveredAt: z.string(),
      signature: z.string().optional(),
    }),
    cancelled: z.object({
      reason: z.string(),
      cancelledBy: z.enum(["customer", "system", "admin"]),
    }),
  },
  state: z.object({
    customerId: z.string(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number(),
        price: z.number(),
      }),
    ),
    status: z.enum(["draft", "confirmed", "shipped", "delivered", "cancelled"]),
    totalAmount: z.number(),
    paymentMethod: z.enum(["card", "paypal", "bank"]).optional(),
    shipping: z
      .object({
        trackingNumber: z.string(),
        carrier: z.string(),
      })
      .optional(),
    deliveredAt: z.string().optional(),
    cancelReason: z.string().optional(),
  }),
  initialEventName: "created",
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
    case "order:itemAdded": {
      const newItem = {
        productId: event.body.productId,
        quantity: event.body.quantity,
        price: event.body.price,
      };
      const existingItemIndex = prevState.items.findIndex(
        (item) => item.productId === event.body.productId,
      );

      let updatedItems;
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
    case "order:itemRemoved": {
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
  addItem(productId: string, quantity: number, price: number) {
    if (!this.canModifyItems) {
      throw new Error(`Cannot modify items in ${this.state.status} status`);
    }

    this.dispatch("order:itemAdded", { productId, quantity, price });
  }

  removeItem(productId: string) {
    if (!this.canModifyItems) {
      throw new Error(`Cannot modify items in ${this.state.status} status`);
    }

    const item = this.state.items.find((i) => i.productId === productId);
    if (!item) {
      throw new Error(`Item ${productId} not found in order`);
    }

    this.dispatch("order:itemRemoved", { productId });
  }

  confirm(paymentMethod: "card" | "paypal" | "bank") {
    if (this.state.status !== "draft") {
      throw new Error(`Cannot confirm order in ${this.state.status} status`);
    }

    if (this.state.items.length === 0) {
      throw new Error("Cannot confirm order with no items");
    }

    this.dispatch("order:confirmed", { paymentMethod });
  }

  ship(trackingNumber: string, carrier: string) {
    if (!this.canShip) {
      throw new Error(`Cannot ship order in ${this.state.status} status`);
    }

    this.dispatch("order:shipped", { trackingNumber, carrier });
  }

  markAsDelivered(signature?: string) {
    if (!this.canDeliver) {
      throw new Error(`Cannot deliver order in ${this.state.status} status`);
    }

    this.dispatch("order:delivered", {
      deliveredAt: new Date().toISOString(),
      signature,
    });
  }

  cancel(reason: string, cancelledBy: "customer" | "system" | "admin") {
    if (
      this.state.status === "delivered" ||
      this.state.status === "cancelled"
    ) {
      throw new Error(`Cannot cancel order in ${this.state.status} status`);
    }

    this.dispatch("order:cancelled", { reason, cancelledBy });
  }
}
