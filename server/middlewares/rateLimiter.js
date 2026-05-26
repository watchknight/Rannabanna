/**
 * Sliding-window in-memory IP Rate Limiter to prevent abuse.
 * Default budget: 100 requests per 15 minutes per IP.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LIMIT = 100;

// Memory storage Map: IP -> timestamps array
const requestsStore = new Map();

// Periodic pruning cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestsStore.entries()) {
    const validTimestamps = timestamps.filter(t => now - t < WINDOW_MS);
    if (validTimestamps.length === 0) {
      requestsStore.delete(ip);
    } else {
      requestsStore.set(ip, validTimestamps);
    }
  }
}, 5 * 60 * 1000); // clean every 5 minutes

/**
 * Sliding window IP rate limiter middleware.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function rateLimiter(req, res, next) {
  // Safe extraction of remote IP
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  if (!requestsStore.has(ip)) {
    // Proactively prevent unbounded memory footprint under massive IP spikes
    if (requestsStore.size >= 10000) {
      const oldestKey = requestsStore.keys().next().value;
      if (oldestKey) requestsStore.delete(oldestKey);
    }
    requestsStore.set(ip, []);
  }

  const timestamps = requestsStore.get(ip);
  
  // Strip out old records exceeding the window size
  const activeTimestamps = timestamps.filter(t => now - t < WINDOW_MS);
  
  if (activeTimestamps.length >= MAX_LIMIT) {
    const oldest = activeTimestamps[0];
    const resetTime = oldest + WINDOW_MS;
    const retryAfter = Math.ceil((resetTime - now) / 1000);

    res.set({
      'X-RateLimit-Limit': MAX_LIMIT,
      'X-RateLimit-Remaining': 0,
      'X-RateLimit-Reset': Math.ceil(resetTime / 1000),
      'Retry-After': retryAfter
    });

    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
      limit: MAX_LIMIT,
      retryAfterSeconds: retryAfter
    });
  }

  // Push current timestamp
  activeTimestamps.push(now);
  requestsStore.set(ip, activeTimestamps);

  const remaining = MAX_LIMIT - activeTimestamps.length;
  const resetTime = activeTimestamps[0] + WINDOW_MS;

  res.set({
    'X-RateLimit-Limit': MAX_LIMIT,
    'X-RateLimit-Remaining': remaining,
    'X-RateLimit-Reset': Math.ceil(resetTime / 1000)
  });

  next();
}
