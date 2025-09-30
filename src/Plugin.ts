import type z from "zod";
import type { BaseSchema } from "./defineSchema";
import type { $$IEntity } from "./Entity";

export type Plugin<Entity extends $$IEntity<BaseSchema>> = {
  onCommited: (args: {
    entity: Entity;
    events: z.infer<Entity[" $$schema"]["event"]>[];
  }) => Promise<void>;
};
