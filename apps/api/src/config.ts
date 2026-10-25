import { z } from 'zod';
const portSchema = z.coerce.number().int().min(1).max(65535);

export const envSchema = z
  .object({
    PORT: portSchema.optional(),
    API_PORT: portSchema.default(4000),
    WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  })
  .transform((env) => ({ ...env, API_PORT: env.PORT ?? env.API_PORT }));
