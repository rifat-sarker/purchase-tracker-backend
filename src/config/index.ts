import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.join(process.cwd(), '.env') });

// Required vars — fail fast with a clear error if missing.
// Clearly-optional integrations (Cloudinary/SMTP) are validated separately
// below and are allowed to be absent; the app degrades gracefully for those.
const requiredEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  OWNER_EMAIL: z.string().min(1, 'OWNER_EMAIL is required'),
  OWNER_PASSWORD_HASH: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3005'),
});

const optionalEnvSchema = z.object({
  REDIS_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  NOTIFICATION_EMAIL_TO: z.string().optional(),
});

const requiredParsed = requiredEnvSchema.safeParse(process.env);

if (!requiredParsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid/missing required environment variables:');
  // eslint-disable-next-line no-console
  console.error(requiredParsed.error.flatten().fieldErrors);
  process.exit(1);
}

const optionalParsed = optionalEnvSchema.parse(process.env);

const required = requiredParsed.data;

const config = {
  env: required.NODE_ENV,
  port: parseInt(required.PORT, 10),
  databaseUrl: required.DATABASE_URL,
  redisUrl: optionalParsed.REDIS_URL,
  jwt: {
    accessSecret: required.JWT_ACCESS_SECRET,
    refreshSecret: required.JWT_REFRESH_SECRET,
    accessExpiresIn: required.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: required.JWT_REFRESH_EXPIRES_IN,
  },
  owner: {
    email: required.OWNER_EMAIL,
    passwordHash: required.OWNER_PASSWORD_HASH,
  },
  cloudinary: {
    cloudName: optionalParsed.CLOUDINARY_CLOUD_NAME,
    apiKey: optionalParsed.CLOUDINARY_API_KEY,
    apiSecret: optionalParsed.CLOUDINARY_API_SECRET,
    isConfigured: Boolean(
      optionalParsed.CLOUDINARY_CLOUD_NAME && optionalParsed.CLOUDINARY_API_KEY && optionalParsed.CLOUDINARY_API_SECRET,
    ),
  },
  smtp: {
    host: optionalParsed.SMTP_HOST,
    port: optionalParsed.SMTP_PORT ? parseInt(optionalParsed.SMTP_PORT, 10) : undefined,
    user: optionalParsed.SMTP_USER,
    password: optionalParsed.SMTP_PASSWORD,
    isConfigured: Boolean(optionalParsed.SMTP_HOST && optionalParsed.SMTP_USER && optionalParsed.SMTP_PASSWORD),
  },
  notificationEmailTo: optionalParsed.NOTIFICATION_EMAIL_TO,
  corsAllowedOrigins: required.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
};

export default config;
