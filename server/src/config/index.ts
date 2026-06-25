import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  port: z.number().default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  
  // MongoDB
  mongodbUri: z.string().min(1),
  
  // Redis
  redisUrl: z.string().min(1),
  
  // JWT
  jwtSecret: z.string().min(32),
  jwtRefreshSecret: z.string().min(32),
  jwtExpiresIn: z.string().default('15m'),
  jwtRefreshExpiresIn: z.string().default('7d'),
  
  // CORS
  clientUrl: z.string().url().default('http://localhost:5173'),
  
  // Rate Limiting
  rateLimitWindowMs: z.number().default(15 * 60 * 1000), // 15 minutes
  rateLimitMax: z.number().default(100),
});

function loadConfig() {
  const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/syncfinance',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production-32chars',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-prod-32c',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  };

  const result = configSchema.safeParse(config);
  
  if (!result.success) {
    console.error('❌ Invalid configuration:', result.error.format());
    process.exit(1);
  }
  
  return result.data;
}

export const config = loadConfig();

export default config;
