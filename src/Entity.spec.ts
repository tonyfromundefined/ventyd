import z from "zod";
import { createRepository } from "./createRepository";
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
    deletedAt: z.string().optional().nullable(),
  }),
  initialEventName: "created",
});

const userReducer = defineReducer(userSchema, (prevState, event) => {
  switch (event.eventName) {
    case "user:created": {
      return {
        nickname: event.body.nickname,
      };
    }
    case "user:deleted": {
      return {
        ...prevState,
        deletedAt: event.eventCreatedAt,
      };
    }
  }
});

class User extends Entity(userSchema, userReducer) {
  get nickname() {
    return this.state.nickname;
  }

  delete() {
    this.dispatch("user:deleted", {});
  }
}

const repo = createRepository({
  entity: User,
  schema: userSchema,
  storage: {} as any,
});
repo.findOne({ entityId: "1234" }).then((u) => u?.nickname);

test("Entity created successfully", () => {
  const user = new User({
    body: {
      nickname: "John Doe",
    },
  });

  expect(user.nickname).toBe("John Doe");
  expect(user[" $$queuedEvents"].length).toEqual(1);
});

test("Entity ID is successfully overridden", () => {
  const user = new User({
    entityId: "123",
    body: {
      nickname: "John Doe",
    },
  });

  expect(user.entityId).toBe("123");
  expect(user[" $$queuedEvents"][0]?.entityId).toEqual("123");
});
