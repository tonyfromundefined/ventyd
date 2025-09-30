import type { $$BaseDefinedSchema } from "./defineSchema";
import type { ConstructorReturnType } from "./util-types";

export type Repository<Entity> = {
  findOneByEntityId: (
    entityId: string,
  ) => Promise<ConstructorReturnType<Entity> | null>;
  commit: (entity: Entity) => Promise<void>;
};

export function createRepository<
  DefinedSchema extends $$BaseDefinedSchema,
  Entity,
>(args: {
  schema: DefinedSchema;
  entity: Entity;
  storage: any;
}): Repository<Entity> {
  return {
    findOneByEntityId: async (entityId) => {
      const entity = await args.storage.findOneByEntityId(entityId);
      return entity;
    },
    async commit(entity) {},
  };
}
