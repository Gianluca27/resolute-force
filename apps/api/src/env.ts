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
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default('Resolute Force <no-reply@resoluteforce.com>'),
  ADMIN_NOTIFY_EMAIL: z.string().default(''),
  ADMIN_EMAIL: z.string().default('admin@resoluteforce.com'),
  ADMIN_PASSWORD: z.string().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
