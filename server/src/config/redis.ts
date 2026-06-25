import { Redis } from 'ioredis';
import config from './index.js';

class RedisClient {
  private static instance: Redis | null = null;
  private static subscriber: Redis | null = null;
  private static publisher: Redis | null = null;

  static getInstance(): Redis {
    if (!this.instance) {
      this.instance = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        // 👇 Upstash TLS & IPv4 Fixes 👇
        family: 4, 
        tls: { rejectUnauthorized: false }
      });

      this.instance.on('connect', () => {
        console.log('✅ Redis connected');
      });

      this.instance.on('error', (error) => {
        console.error('Redis error:', error.message);
      });

      this.instance.on('close', () => {
        console.warn('Redis connection closed');
      });
    }
    return this.instance;
  }

  static getSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        // 👇 Upstash TLS & IPv4 Fixes 👇
        family: 4,
        tls: { rejectUnauthorized: false }
      });
    }
    return this.subscriber;
  }

  static getPublisher(): Redis {
    if (!this.publisher) {
      this.publisher = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        // 👇 Upstash TLS & IPv4 Fixes 👇
        family: 4,
        tls: { rejectUnauthorized: false }
      });
    }
    return this.publisher;
  }

  static async connect(): Promise<void> {
    try {
      await this.getInstance().connect();
      await this.getSubscriber().connect();
      await this.getPublisher().connect();
      console.log('✅ Redis Pub/Sub ready');
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      // Don't exit - Redis is optional for basic functionality
    }
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.quit();
    }
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    if (this.publisher) {
      await this.publisher.quit();
    }
  }
}

export const redis = RedisClient.getInstance();
export const redisSub = RedisClient.getSubscriber();
export const redisPub = RedisClient.getPublisher();
export const connectRedis = RedisClient.connect.bind(RedisClient);
export const disconnectRedis = RedisClient.disconnect.bind(RedisClient);

export default RedisClient;
