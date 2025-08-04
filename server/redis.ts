import Redis from 'ioredis';

// Redis client configuration
let redis: Redis | null = null;
let redisAvailable = false;

export function createRedisClient(): Redis | null {
  if (redis) {
    return redis;
  }

  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.log('[Redis] No REDIS_URL environment variable found - using in-memory fallback');
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

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