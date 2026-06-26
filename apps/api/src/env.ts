import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('file:./dev.db'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:5173'),
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),
  JWT_SECRET: z.string().min(32).default('dev-secret-change-me-in-production!!'),
  MP_ACCESS_TOKEN: z.string().default('TEST-ACCESS-TOKEN'),
  MP_PUBLIC_KEY: z.string().default('TEST-PUBLIC-KEY'),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
