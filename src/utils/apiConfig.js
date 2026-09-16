/**
 * Centralized API base URL resolver.
 * In development (port 5173), targets Express on http://localhost:3001.
 * Can be overridden via VITE_API_BASE_URL environment variable.
 */
export function getApiBase() {
  if (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) {
    return process.env.VITE_API_BASE_URL;
  }
  if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    const port = window.location.port;
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocal && (port === '5173' || port === '5174' || port === '5175' || port === '3000')) {
      return 'http://localhost:3001';
    }
  }
  return '';
}

export const API_BASE = getApiBase();

/**
 * Probes the backend server health with a sane timeout.
 * @param {number} [timeoutMs=2500] 
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth(timeoutMs = 2500) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${API_BASE}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Helper to safely parse JSON or extract text error message from a fetch Response.
 * Prevents "Unexpected end of JSON input" errors.
 * @param {Response} res 
 * @returns {Promise<any>}
 */
export async function safeParseJson(res) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }
  const text = await res.text();
  return { message: text || `HTTP ${res.status} ${res.statusText}` };
}
