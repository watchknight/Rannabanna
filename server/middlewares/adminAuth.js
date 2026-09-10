import crypto from 'crypto';

// In-memory active admin session tokens with 24-hour expiration
const activeTokens = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Retrieves the configured admin password or default
 */
export function getAdminSecret() {
  return process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET_KEY || 'rannabanna2026';
}

/**
 * Verifies admin password and generates an active session token
 * @param {string} password 
 * @returns {{ success: boolean, token?: string, error?: string }}
 */
export function authenticateAdmin(password) {
  const secret = getAdminSecret();
  if (!password || password !== secret) {
    return { success: false, error: 'Invalid admin credentials' };
  }

  const token = 'adm_' + crypto.randomBytes(32).toString('hex');
  activeTokens.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  });

  return { success: true, token };
}

/**
 * Invalidates an active admin token (Logout)
 * @param {string} token 
 */
export function invalidateAdminToken(token) {
  activeTokens.delete(token);
}

/**
 * Express middleware to guard /api/admin/* endpoints
 */
export function adminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const directKey = req.headers['x-admin-key'];
  const secret = getAdminSecret();

  // Allow direct access via secret key (e.g. for scripts/cURL)
  if (directKey && directKey === secret) {
    return next();
  }

  // Check Bearer token from header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const session = activeTokens.get(token);

    if (session) {
      if (Date.now() < session.expiresAt) {
        return next();
      } else {
        activeTokens.delete(token);
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Admin session has expired. Please log in again.'
        });
      }
    }
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Admin authorization required to access this resource.'
  });
}
