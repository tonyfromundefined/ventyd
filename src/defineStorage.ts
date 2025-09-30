import type { z } from "zod";
import type { BaseSchema } from "./defineSchema";

export type Storage = {
  /**
   * Gets events by entity ID.
   */
  getEventsByEntityId: (args: {
    entityName: string;
    entityId: string;
  }) => Promise<z.infer<BaseSchema["event"]>[]>;

  /**
   * Commits events to the storage.
   */
  commitEvents(args: { events: z.infer<BaseSchema["event"]>[] }): Promise<void>;
};

export function defineStorage(storage: Storage): Storage {
  return storage;
}
