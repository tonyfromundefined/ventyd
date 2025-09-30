import type z from "zod";
import type { BaseSchema } from "./defineSchema";
import type { Storage } from "./defineStorage";
import type { Plugin } from "./Plugin";
import type { ConstructorReturnType } from "./util-types";

export type Repository<Entity> = {
  /**
   * Finds an entity by its `entityId`.
   * @returns The entity if found, otherwise null.
   */
  findOne: (args: {
    entityId: string;
  }) => Promise<ConstructorReturnType<Entity> | null>;

  /**
   * Commits an entity to the repository.
   * @param entity - The entity to commit.
   */
  commit: (entity: ConstructorReturnType<Entity>) => Promise<void>;
};

export function createRepository<
  Schema extends BaseSchema,
  Entity extends new () => {
    " $$queuedEvents": z.infer<Schema["event"]>[];
    " $$hydrate": (events: z.infer<Schema["event"]>[]) => void;
    " $$flush": () => void;
  },
>(args: {
  schema: Schema;
  entity: Entity;
  plugins?: Plugin<Entity>[];
  storage: Storage;
}): Repository<Entity> {
  return {
    async findOne({ entityId }) {
      const entityName = args.schema[" $$entityName"];
      const Entity = args.entity;

      // 1. query events by entity ID
      const events = (await args.storage.getEventsByEntityId({
        entityName: entityName,
        entityId: entityId,
      })) as z.infer<Schema["event"]>[];

      // 2. hydrate entity
      const entity = new Entity() as ConstructorReturnType<Entity>;
      entity[" $$hydrate"](events);

      return entity;
    },
    async commit(entity) {
      // 1. copy queued events
      const queuedEvents = [...entity[" $$queuedEvents"]];

      // 2. commit events to storage
      await args.storage.commitEvents({
        events: queuedEvents,
      });

      // 3. flush queued events
      entity[" $$flush"]();
    },
  };
}
