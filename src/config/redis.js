const Redis = require('redis');
const logger = require('./logger');

let client;

// Create Redis client
const createClient = () => {
    if (!client) {
        client = Redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            password: process.env.REDIS_PASSWORD
        });

        // Handle Redis connection events
        client.on('connect', () => {
            logger.info('Redis client connected');
        });

        client.on('error', (err) => {
            logger.error('Redis client error:', err);
        });

        client.on('reconnecting', () => {
            logger.info('Redis client reconnecting');
        });
    }
    return client;
};

// Cache wrapper with Redis
const cache = {
    async get(key, fetchData, ttl = 3600) {
        try {
            // Try to get data from cache
            const cachedData = await client.get(key);
            if (cachedData) {
                return JSON.parse(cachedData);
            }

            // If not in cache, fetch data
            const data = await fetchData();
            
            // Store in cache
            if (data) {
                await client.setEx(key, ttl, JSON.stringify(data));
            }

            return data;
        } catch (error) {
            logger.error(`Cache error for key ${key}:`, error);
            // If cache fails, just fetch the data
            return await fetchData();
        }
    },

    async set(key, data, ttl = 3600) {
        try {
            await client.setEx(key, ttl, JSON.stringify(data));
        } catch (error) {
            logger.error(`Cache set error for key ${key}:`, error);
        }
    },

    async del(key) {
        try {
            await client.del(key);
        } catch (error) {
            logger.error(`Cache delete error for key ${key}:`, error);
        }
    },

    async delPattern(pattern) {
        try {
            const keys = await client.keys(pattern);
            if (keys.length > 0) {
                await client.del(keys);
            }
        } catch (error) {
            logger.error(`Cache delete pattern error for ${pattern}:`, error);
        }
    }
};

// Initialize Redis
const initializeRedis = async () => {
    try {
        if (!client) {
            client = createClient();
        }
        if (!client.isOpen) {
            await client.connect();
        }
        logger.info('Redis initialized successfully');
    } catch (error) {
        logger.error('Redis initialization error:', error);
        // Don't exit process, allow app to run without Redis
    }
};

// Rate limiting functions
const incrementRequestCount = async (key) => {
    try {
        const count = await client.incr(key);
        if (count === 1) {
            await client.expire(key, 60); // 60 seconds window
        }
        return count;
    } catch (error) {
        logger.error(`Rate limiting error: ${error}`);
        return 1; // Fail open
    }
};

// Cleanup on app termination
process.on('SIGINT', async () => {
    try {
        if (client && client.isOpen) {
            await client.quit();
            logger.info('Redis connection closed through app termination');
        }
    } catch (err) {
        logger.error(`Error closing Redis connection: ${err}`);
    }
});

module.exports = {
    client,
    cache,
    initializeRedis,
    incrementRequestCount
}; 