import type { MutationMethod } from "./MutationMethod";

export type ReadonlyEntity<$$Entity> = {
  [key in keyof $$Entity]: $$Entity[key] extends MutationMethod<unknown>
    ? never
    : $$Entity[key];
};
