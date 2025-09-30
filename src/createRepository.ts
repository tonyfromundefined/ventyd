import type z from "zod";
import type { BaseSchema } from "./defineSchema";
import type { Storage } from "./defineStorage";
import type { IBaseEntity } from "./Entity";
import type { Plugin } from "./Plugin";
import type { ConstructorReturnType } from "./util-types";

export type Repository<Entity> = {
  /**
   * Finds an entity by its `entityId`.
   * @returns The entity if found, otherwise null.
   */
  findOne: (args: { entityId: string }) => Promise<Entity | null>;

  /**
   * Commits an entity to the repository.
   * @param entity - The entity to commit.
   */
  commit: (entity: Entity) => Promise<void>;
};

export function createRepository<
  Schema extends BaseSchema,
  EntityConstructor extends new () => IBaseEntity<Schema>,
>(args: {
  schema: Schema;
  entity: EntityConstructor;
  storage: Storage;
  plugins?: Plugin<ConstructorReturnType<EntityConstructor>>[];
}): Repository<ConstructorReturnType<EntityConstructor>> {
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
      const entity = new Entity() as ConstructorReturnType<EntityConstructor>;
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

      // 4. trigger plugins
      for (const plugin of args.plugins ?? []) {
        await plugin.onCommited({ entity, events: queuedEvents });
      }
    },
  };
}
