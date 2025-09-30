import type z from "zod";
import type { BaseSchema } from "./defineSchema";
import type { IBaseEntity } from "./Entity";

export type Plugin<Entity extends IBaseEntity<BaseSchema>> = {
  onCommited: (args: {
    entity: Entity;
    events: z.infer<Entity[" $$schema"]["event"]>[];
  }) => Promise<void>;
};
