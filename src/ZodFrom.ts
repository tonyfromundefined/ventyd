import type z from "zod";

export type $$ZodFrom<T extends { " $$schema": z.ZodSchema }> = z.infer<
  T[" $$schema"]
>;
