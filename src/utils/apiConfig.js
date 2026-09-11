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
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return 'http://localhost:3001';
  }
  return '';
}

export const API_BASE = getApiBase();

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
