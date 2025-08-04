import Redis from 'ioredis';

// Redis client configuration
let redis: Redis | null = null;
let redisAvailable = false;

export function createRedisClient(): Redis | null {
  if (redis) {
    return redis;
  }

  // Try Redis connection string first (preferred)
  const redisUrl = process.env.REDIS_URL;
  
  // Fallback to Upstash REST credentials
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!redisUrl && !upstashUrl) {
    console.log('[Redis] No Redis credentials found - using in-memory fallback');
    return null;
  }

  try {
    if (redisUrl) {
      // Use traditional Redis connection string
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
      });
      console.log('[Redis] Using Redis connection string');
    } else if (upstashUrl && upstashToken) {
      // Convert Upstash REST URL to Redis connection
      const url = new URL(upstashUrl);
      const redisConnectionString = `rediss://default:${upstashToken}@${url.hostname}:6380`;
      
      redis = new Redis(redisConnectionString, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
        tls: {
          rejectUnauthorized: false
        }
      });
      console.log('[Redis] Using Upstash REST credentials converted to Redis connection');
    }

    if (redis) {
      redis.on('connect', () => {
        console.log('[Redis] Connected successfully');
        redisAvailable = true;
      });

      redis.on('error', (err) => {
        console.error('[Redis] Connection error:', err);
        redisAvailable = false;
      });

      redis.on('ready', () => {
        console.log('[Redis] Ready for commands');
        redisAvailable = true;
      });

      redis.on('end', () => {
        console.log('[Redis] Connection ended');
        redisAvailable = false;
      });
    }

    return redis;
  } catch (error) {
    console.error('[Redis] Failed to create client:', error);
    redisAvailable = false;
    return null;
  }
}

export function getRedisClient(): Redis | null {
  if (!redis) {
    redis = createRedisClient();
  }
  return redis;
}

export function isRedisAvailable(): boolean {
  return redisAvailable && redis !== null;
}

export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    await redis.disconnect();
    redis = null;
    redisAvailable = false;
  }
}