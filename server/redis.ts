import Redis from 'ioredis';

// Redis client configuration
let redis: Redis | null = null;
let redisAvailable = false;

export function createRedisClient(): Redis | null {
  if (redis) {
    return redis;
  }

  // Check environment variables and clean them
  let redisUrl = process.env.REDIS_URL;
  const upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  // Handle case where UPSTASH_REDIS_REST_URL contains a Redis connection string
  if (upstashRestUrl && upstashRestUrl.includes('rediss://')) {
    // Extract the Redis connection string from the environment variable
    const match = upstashRestUrl.match(/rediss:\/\/[^"]+/);
    if (match) {
      redisUrl = match[0];
      console.log('[Redis] Found Redis connection string in UPSTASH_REDIS_REST_URL');
    }
  }
  
  if (!redisUrl && !upstashRestUrl) {
    console.log('[Redis] No Redis credentials found - using in-memory fallback');
    return null;
  }

  try {
    if (redisUrl) {
      // Use Redis connection string
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
        tls: {
          rejectUnauthorized: false
        }
      });
      console.log('[Redis] Using Redis connection string');
    } else if (upstashRestUrl && upstashToken) {
      // Convert Upstash REST URL to Redis connection
      const cleanUrl = upstashRestUrl.replace(/['"]/g, '');
      const cleanToken = upstashToken.replace(/['"]/g, '');
      
      const url = new URL(cleanUrl);
      const redisConnectionString = `rediss://default:${cleanToken}@${url.hostname}:6380`;
      
      redis = new Redis(redisConnectionString, {
        maxRetriesPerRequest: 3,
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