import * as v from "valibot";
import { defineReducer, defineSchema, Entity } from "../../src";
import { valibot } from "../../src/valibot";

/**
 * User entity schema definition
 */
export const userSchema = defineSchema("user", {
  schema: valibot({
    event: {
      created: v.object({
        nickname: v.string(),
        email: v.pipe(v.string(), v.email()),
      }),
      profile_updated: v.object({
        nickname: v.optional(v.string()),
        bio: v.optional(v.string()),
      }),
      deleted: v.object({
        reason: v.optional(v.string()),
      }),
      restored: v.object({}),
    },
    state: v.object({
      nickname: v.string(),
      email: v.pipe(v.string(), v.email()),
      bio: v.optional(v.string()),
      deletedAt: v.nullable(v.optional(v.string())),
    }),
  }),
  initialEventName: "user:created",
});

/**
 * User entity reducer
 */
export const userReducer = defineReducer(userSchema, (prevState, event) => {
  switch (event.eventName) {
    case "user:created": {
      return {
        nickname: event.body.nickname,
        email: event.body.email,
        bio: undefined,
        deletedAt: null,
      };
    }
    case "user:profile_updated": {
      return {
        ...prevState,
        ...(event.body.nickname && { nickname: event.body.nickname }),
        ...(event.body.bio !== undefined && { bio: event.body.bio }),
      };
    }
    case "user:deleted": {
      return {
        ...prevState,
        deletedAt: event.eventCreatedAt,
      };
    }
    case "user:restored": {
      return {
        ...prevState,
        deletedAt: null,
      };
    }
    default: {
      return prevState;
    }
  }
});

/**
 * User entity class with business logic
 */
export class User extends Entity(userSchema, userReducer) {
  // ----------------------
  // Getters for easy access
  // ----------------------
  get nickname() {
    return this.state.nickname;
  }

  get email() {
    return this.state.email;
  }

  get bio() {
    return this.state.bio;
  }

  get isDeleted() {
    return this.state.deletedAt !== null;
  }

  // ----------------------
  // Business methods
  // ----------------------
  updateProfile(updates: { nickname?: string; bio?: string }) {
    if (this.isDeleted) {
      throw new Error("Cannot update profile of deleted user");
    }

    this.dispatch("user:profile_updated", updates);
  }

  delete(reason?: string) {
    if (this.isDeleted) {
      throw new Error("User is already deleted");
    }

    this.dispatch("user:deleted", { reason });
  }

  restore() {
    if (!this.isDeleted) {
      throw new Error("User is not deleted");
    }

    this.dispatch("user:restored", {});
  }
}
