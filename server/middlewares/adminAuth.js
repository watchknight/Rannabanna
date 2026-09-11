import crypto from 'crypto';

// In-memory revoked tokens set (for explicit logout)
const revokedTokens = new Set();
const activeTokens = new Map(); // Legacy support
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Retrieves the configured admin password or default
 */
export function getAdminSecret() {
  return process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET_KEY || 'rannabanna2026';
}

/**
 * Generates an HMAC signature for a stateless session token.
 */
function signToken(expiresAt, nonce, secret) {
  return crypto.createHmac('sha256', secret).update(`adm:${expiresAt}:${nonce}`).digest('hex');
}

/**
 * Verifies admin password and generates a stateless HMAC-signed session token.
 * Survives container spin-downs, restarts, and multi-instance restarts.
 *
 * @param {string} password 
 * @returns {{ success: boolean, token?: string, error?: string }}
 */
export function authenticateAdmin(password) {
  const secret = getAdminSecret();
  if (!password || password !== secret) {
    return { success: false, error: 'Invalid admin credentials' };
  }

  const expiresAt = Date.now() + SESSION_TTL_MS;
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = signToken(expiresAt, nonce, secret);
  const token = `adm_${expiresAt}_${nonce}_${signature}`;

  // Also retain in memory map for backward-compatibility
  activeTokens.set(token, { createdAt: Date.now(), expiresAt });

  return { success: true, token };
}

/**
 * Invalidates an active admin token (Logout)
 * @param {string} token 
 */
export function invalidateAdminToken(token) {
  if (token) {
    revokedTokens.add(token);
    activeTokens.delete(token);
  }
}

/**
 * Verifies if a given token string is valid and unexpired.
 * @param {string} token
 * @returns {boolean}
 */
export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return false;
  if (revokedTokens.has(token)) return false;

  // 1. Check stateless HMAC token format (adm_<expiresAt>_<nonce>_<signature>)
  if (token.startsWith('adm_')) {
    const parts = token.split('_');
    if (parts.length === 4) {
      const [prefix, expiresAtStr, nonce, sig] = parts;
      const expiresAt = parseInt(expiresAtStr, 10);
      if (isNaN(expiresAt) || Date.now() > expiresAt) {
        return false;
      }
      const secret = getAdminSecret();
      const expectedSig = signToken(expiresAtStr, nonce, secret);
      // Constant-time comparison
      return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'));
    }
  }

  // 2. Fallback to memory map (for legacy tokens)
  const session = activeTokens.get(token);
  if (session && Date.now() < session.expiresAt) {
    return true;
  }

  return false;
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
    if (verifyAdminToken(token)) {
      return next();
    }
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin session is invalid or expired. Please log in again.'
    });
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Admin authorization required to access this resource.'
  });
}
