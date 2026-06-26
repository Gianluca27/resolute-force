import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('file:./dev.db'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().default('dev-secret-change-me'),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
