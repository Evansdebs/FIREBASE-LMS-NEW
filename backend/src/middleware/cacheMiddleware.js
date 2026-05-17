const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // default 5 minutes

/**
 * Express middleware to cache responses based on user ID and URL.
 * Will capture res.json and store it in cache before sending to the client.
 */
const cacheMiddleware = (req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }

  // Create key using user ID and the requested URL
  // If no user is logged in, use a generic "anonymous" prefix or just the URL
  const userId = req.user ? req.user.id : 'anonymous';
  const key = `${userId}:${req.originalUrl}`;

  const cachedResponse = cache.get(key);
  if (cachedResponse) {
    return res.json(cachedResponse);
  }

  // Hijack res.json
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    cache.set(key, body);
    originalJson(body);
  };

  next();
};

/**
 * Utility to manually clear cache if needed
 */
const clearCache = () => {
  cache.flushAll();
};

module.exports = { cacheMiddleware, clearCache };
