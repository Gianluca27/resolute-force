import { z } from 'zod';

const INSECURE_JWT_DEFAULT = 'dev-secret-change-me-in-production!!';
const PLACEHOLDER_MP_TOKEN = 'TEST-ACCESS-TOKEN';

const schema = z
  .object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().default(4000),
    // Express `trust proxy` setting. Empty/false = no proxy (req.ip is the socket peer).
    // Set to the number of trusted reverse proxies/LB hops in front of the API (e.g. `1`),
    // or a comma-separated IP/subnet list / preset (e.g. `loopback`). Required for per-IP
    // rate limiting to work behind a proxy without letting clients spoof X-Forwarded-For.
    TRUST_PROXY: z.string().default(''),
    DATABASE_URL: z.string().default('file:./dev.db'),
    PUBLIC_WEB_URL: z.string().default('http://localhost:5173'),
    PUBLIC_API_URL: z.string().default('http://localhost:4000'),
    JWT_SECRET: z.string().min(32).default(INSECURE_JWT_DEFAULT),
    MP_ACCESS_TOKEN: z.string().default(PLACEHOLDER_MP_TOKEN),
    MP_PUBLIC_KEY: z.string().default('TEST-PUBLIC-KEY'),
    MP_WEBHOOK_SECRET: z.string().default(''),
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
  })
  // Production must never run on the public dev fallbacks — fail fast on boot.
  .superRefine((val, ctx) => {
    if (val.NODE_ENV !== 'production') return;
    if (val.JWT_SECRET === INSECURE_JWT_DEFAULT) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'JWT_SECRET must be set to a strong, unique value in production (the dev default is public)' });
    }
    if (val.MP_ACCESS_TOKEN === PLACEHOLDER_MP_TOKEN) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MP_ACCESS_TOKEN'], message: 'MP_ACCESS_TOKEN must be a real MercadoPago token in production' });
    }
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(raw: Record<string, string | undefined> = process.env): Env {
  return schema.parse(raw);
}

export const env = parseEnv();
