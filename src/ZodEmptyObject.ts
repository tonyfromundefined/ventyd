import type { z } from "zod";

export type ZodEmptyObject = z.ZodObject<{}, z.core.$strip>;
