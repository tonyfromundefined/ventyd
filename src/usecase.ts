import z from "zod";
import { defineReducer } from "./defineReducer";
import { defineSchema } from "./defineSchema";
import { Entity } from "./Entity";

const userSchema = defineSchema("user", {
  event: {
    created: z.object({
      nickname: z.string(),
    }),
    deleted: z.object({}),
  },
  state: z.object({
    nickname: z.string(),
  }),
  initialEventName: "created",
});

const userReducer = defineReducer(userSchema, (prevState, event) => {
  return prevState;
});

export class User extends Entity("User", userSchema, userReducer) {
  get nickname() {
    return this.state.nickname;
  }

  delete() {
    this.dispatch("user:deleted", {});
  }
}
