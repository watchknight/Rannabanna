/**
 * Sliding-window in-memory IP Rate Limiter to prevent abuse and control Gemini API costs.
 */

// Social and search crawlers regex / list
const CRAWLER_USER_AGENTS = [
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'discordbot',
  'whatsapp',
  'telegrambot',
  'slackbot',
  'linkedinbot',
  'googlebot',
  'bingbot',
  'applebot'
];

/**
 * Creates a sliding-window rate limiter middleware instance.
 *
 * @param {Object} options
 * @param {number} [options.windowMs=900000] - Time window in milliseconds (default: 15 mins)
 * @param {number} [options.max=100] - Max allowed requests per window
 * @param {string} [options.message='Too Many Requests'] - Error message returned when limit is exceeded
 * @param {string} [options.keyPrefix='rl'] - Prefix for rate limit store keys
 * @returns {import('express').RequestHandler}
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = 'Too Many Requests',
  keyPrefix = 'rl'
} = {}) {
  // Memory storage Map: IP -> timestamps array
  const requestsStore = new Map();

  // Periodic pruning cleanup to prevent memory leaks
  const intervalId = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of requestsStore.entries()) {
      const validTimestamps = timestamps.filter(t => now - t < windowMs);
      if (validTimestamps.length === 0) {
        requestsStore.delete(key);
      } else {
        requestsStore.set(key, validTimestamps);
      }
    }
  }, 5 * 60 * 1000);

  // Unref interval so it doesn't hold Node process alive in tests
  if (intervalId && typeof intervalId.unref === 'function') {
    intervalId.unref();
  }

  const limiterMiddleware = function (req, res, next) {
    // Allow social crawlers and search engine preview unfurl bots without rate limiting
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    if (CRAWLER_USER_AGENTS.some(bot => userAgent.includes(bot))) {
      return next();
    }

    // Safe extraction of remote IP (taking first hop if forwarded, preventing header rotation spoofing)
    const forwarded = typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : null;
    const ip = req.ip || forwarded || req.socket?.remoteAddress || 'unknown';
    const storeKey = `${keyPrefix}:${ip}`;
    const now = Date.now();

    if (!requestsStore.has(storeKey)) {
      // Proactively prevent unbounded memory footprint under massive IP spikes
      if (requestsStore.size >= 10000) {
        const oldestKey = requestsStore.keys().next().value;
        if (oldestKey) requestsStore.delete(oldestKey);
      }
      requestsStore.set(storeKey, []);
    }

    const timestamps = requestsStore.get(storeKey);

    // Strip out old records exceeding the window size
    const activeTimestamps = timestamps.filter(t => now - t < windowMs);

    if (activeTimestamps.length >= max) {
      const oldest = activeTimestamps[0];
      const resetTime = oldest + windowMs;
      const retryAfter = Math.max(1, Math.ceil((resetTime - now) / 1000));

      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': Math.ceil(resetTime / 1000),
        'Retry-After': retryAfter
      });

      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: `${message} Please try again in ${retryAfter} seconds.`,
        limit: max,
        retryAfterSeconds: retryAfter
      });
    }

    // Push current timestamp
    activeTimestamps.push(now);
    requestsStore.set(storeKey, activeTimestamps);

    const remaining = max - activeTimestamps.length;
    const resetTime = (activeTimestamps[0] || now) + windowMs;

    res.set({
      'X-RateLimit-Limit': max,
      'X-RateLimit-Remaining': remaining,
      'X-RateLimit-Reset': Math.ceil(resetTime / 1000)
    });

    next();
  };

  limiterMiddleware.reset = () => {
    requestsStore.clear();
  };

  return limiterMiddleware;
}

/**
 * Standard global rate limiter: 100 requests per 15 minutes per IP
 */
export const rateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'General rate limit exceeded.',
  keyPrefix: 'global'
});

/**
 * Specialized AI Recipe Generation Rate Limiter:
 * Cost control: Max 10 custom recipe generations per 10 minutes per IP
 */
export const aiRecipeRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'AI custom recipe generation rate limit reached (max 10 recipes per 10 minutes).',
  keyPrefix: 'ai-recipe'
});

/**
 * Specialized AI Translation Rate Limiter:
 * Cost control: Max 30 translations per 5 minutes per IP
 */
export const aiTranslationRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: 'AI translation rate limit reached (max 30 requests per 5 minutes).',
  keyPrefix: 'ai-trans'
});
