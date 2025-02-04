const Redis = require('redis');
const logger = require('./logger');

let redisClient;

const initializeRedis = async () => {
    try {
        redisClient = Redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        logger.error('Redis max retries reached. Giving up.');
                        return new Error('Redis max retries reached');
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        });

        redisClient.on('error', (err) => {
            logger.error(`Redis Error: ${err}`);
        });

        redisClient.on('connect', () => {
            logger.info('Redis connected');
        });

        redisClient.on('reconnecting', () => {
            logger.warn('Redis reconnecting');
        });

        await redisClient.connect();
    } catch (error) {
        logger.error(`Redis initialization error: ${error}`);
        process.exit(1);
    }
};

// Cache middleware
const cache = async (key, callback, expireTime = 3600) => {
    try {
        const cachedData = await redisClient.get(key);
        if (cachedData) {
            return JSON.parse(cachedData);
        }

        const freshData = await callback();
        await redisClient.setEx(key, expireTime, JSON.stringify(freshData));
        return freshData;
    } catch (error) {
        logger.error(`Cache error: ${error}`);
        return callback();
    }
};

// Rate limiting functions
const incrementRequestCount = async (key) => {
    try {
        const count = await redisClient.incr(key);
        if (count === 1) {
            await redisClient.expire(key, 60); // 60 seconds window
        }
        return count;
    } catch (error) {
        logger.error(`Rate limiting error: ${error}`);
        return 1; // Fail open
    }
};

process.on('SIGINT', async () => {
    try {
        await redisClient.quit();
        logger.info('Redis connection closed through app termination');
    } catch (err) {
        logger.error(`Error closing Redis connection: ${err}`);
    }
});

module.exports = {
    initializeRedis,
    cache,
    incrementRequestCount,
    getRedisClient: () => redisClient
}; 