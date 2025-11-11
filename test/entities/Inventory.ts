import { type } from "arktype";
import { defineReducer, defineSchema, Entity, mutation } from "../../src";
import { arktype } from "../../src/arktype";

/**
 * Inventory entity schema definition using ArkType
 * Demonstrates ArkType integration with Ventyd
 */
export const inventorySchema = defineSchema("inventory", {
  schema: arktype({
    event: {
      created: type({
        itemName: "string",
        sku: "string",
        quantity: "number>=0",
        location: "string",
      }),
      quantity_adjusted: type({
        quantity: "number",
        reason: "string",
      }),
      location_changed: type({
        oldLocation: "string",
        newLocation: "string",
      }),
      details_updated: type({
        "itemName?": "string",
        "sku?": "string",
      }),
      depleted: type({
        reason: "string",
      }),
      restocked: type({}),
    },
    state: type({
      itemName: "string",
      sku: "string",
      quantity: "number",
      location: "string",
      isDepleted: "boolean",
      depletedReason: "string | undefined",
    }),
  }),
  initialEventName: "inventory:created",
});

/**
 * Inventory entity reducer
 */
export const inventoryReducer = defineReducer(
  inventorySchema,
  (prevState, event) => {
    switch (event.eventName) {
      case "inventory:created": {
        return {
          itemName: event.body.itemName,
          sku: event.body.sku,
          quantity: event.body.quantity,
          location: event.body.location,
          isDepleted: false,
          depletedReason: undefined,
        };
      }
      case "inventory:quantity_adjusted": {
        return {
          ...prevState,
          quantity: prevState.quantity + event.body.quantity,
        };
      }
      case "inventory:location_changed": {
        return {
          ...prevState,
          location: event.body.newLocation,
        };
      }
      case "inventory:details_updated": {
        return {
          ...prevState,
          ...(event.body.itemName && { itemName: event.body.itemName }),
          ...(event.body.sku && { sku: event.body.sku }),
        };
      }
      case "inventory:depleted": {
        return {
          ...prevState,
          isDepleted: true,
          depletedReason: event.body.reason,
        };
      }
      case "inventory:restocked": {
        return {
          ...prevState,
          isDepleted: false,
          depletedReason: undefined,
        };
      }
      default: {
        return prevState;
      }
    }
  },
);

/**
 * Inventory entity class with business logic
 */
export class Inventory extends Entity(inventorySchema, inventoryReducer) {
  // ----------------------
  // Getters
  // ----------------------
  get itemName() {
    return this.state.itemName;
  }

  get sku() {
    return this.state.sku;
  }

  get quantity() {
    return this.state.quantity;
  }

  get location() {
    return this.state.location;
  }

  get isDepleted() {
    return this.state.isDepleted;
  }

  get isAvailable() {
    return !this.state.isDepleted && this.state.quantity > 0;
  }

  get depletedReason() {
    return this.state.depletedReason;
  }

  // ----------------------
  // Business methods
  // ----------------------
  adjustQuantity = mutation(
    this,
    (dispatch, quantity: number, reason: string) => {
      if (this.isDepleted) {
        throw new Error("Cannot adjust quantity of depleted inventory");
      }

      const newQuantity = this.state.quantity + quantity;
      if (newQuantity < 0) {
        throw new Error(
          `Insufficient quantity. Current: ${this.state.quantity}, Requested: ${Math.abs(quantity)}`,
        );
      }

      dispatch("inventory:quantity_adjusted", { quantity, reason });
    },
  );

  changeLocation = mutation(this, (dispatch, newLocation: string) => {
    if (this.isDepleted) {
      throw new Error("Cannot change location of depleted inventory");
    }

    dispatch("inventory:location_changed", {
      oldLocation: this.state.location,
      newLocation,
    });
  });

  updateDetails = mutation(
    this,
    (dispatch, updates: { itemName?: string; sku?: string }) => {
      if (this.isDepleted) {
        throw new Error("Cannot update details of depleted inventory");
      }

      if (Object.keys(updates).length === 0) {
        throw new Error("At least one field must be updated");
      }

      dispatch("inventory:details_updated", updates);
    },
  );

  markAsDepleted = mutation(this, (dispatch, reason: string) => {
    if (this.isDepleted) {
      throw new Error("Inventory is already depleted");
    }

    dispatch("inventory:depleted", { reason });
  });

  restock = mutation(this, (dispatch) => {
    if (!this.isDepleted) {
      throw new Error("Inventory is not depleted");
    }

    dispatch("inventory:restocked", {});
  });
}
