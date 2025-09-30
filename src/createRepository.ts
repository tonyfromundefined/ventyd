import type { BaseSchema } from "./defineSchema";
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
  commit: (entity: Entity) => Promise<void>;
};

export function createRepository<Schema extends BaseSchema, Entity>(args: {
  schema: Schema;
  entity: Entity;
  storage: any;
}): Repository<Entity> {
  return {
    async findOne({ entityId }) {
      const entity = await args.storage.findOneByEntityId(entityId);
      return entity;
    },
    async commit(entity) {},
  };
}
