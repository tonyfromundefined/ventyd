import { z } from "zod";
import { defineSchema } from "../../src/defineSchema";
import { defineReducer } from "../../src/defineReducer";
import { Entity } from "../../src/Entity";

/**
 * User entity schema definition
 */
export const userSchema = defineSchema("user", {
  event: {
    created: z.object({
      nickname: z.string(),
      email: z.string().email(),
    }),
    profileUpdated: z.object({
      nickname: z.string().optional(),
      bio: z.string().optional(),
    }),
    deleted: z.object({
      reason: z.string().optional(),
    }),
    restored: z.object({}),
  },
  state: z.object({
    nickname: z.string(),
    email: z.string().email(),
    bio: z.string().optional(),
    deletedAt: z.string().optional().nullable(),
  }),
  initialEventName: "created",
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
    case "user:profileUpdated": {
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

    this.dispatch("user:profileUpdated", updates);
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
