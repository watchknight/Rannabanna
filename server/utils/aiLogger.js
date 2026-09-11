import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_DIR = path.resolve(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'gemini_failures.log');

// In-memory ring buffer of recent failures (up to 100 entries)
const recentFailures = [];
const MAX_BUFFER_SIZE = 100;

/**
 * Sanitizes input context before logging to avoid exposing API keys or huge payloads.
 */
function sanitizeContext(context = {}) {
  if (!context || typeof context !== 'object') {
    return { summary: String(context).slice(0, 150) };
  }

  const safe = {};
  for (const [key, value] of Object.entries(context)) {
    // Redact secret fields
    if (/key|secret|token|auth/i.test(key)) {
      safe[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      safe[key] = value.length > 200 ? `${value.slice(0, 200)}... (${value.length} chars)` : value;
    } else if (Array.isArray(value)) {
      safe[key] = value.length > 10 ? `[Array of ${value.length} items: ${value.slice(0, 5).join(', ')}...]` : value;
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * Logs a Gemini API failure with structured metadata.
 *
 * @param {Object} entry
 * @param {string} entry.service - e.g. 'CUSTOM_RECIPE', 'TRANSLATE_TEXT', 'TRANSLATE_RECIPE'
 * @param {string} [entry.model='gemini-3.8-flash'] - Model identifier
 * @param {Error|Object|string} entry.error - Error object or message
 * @param {Object} [entry.context={}] - Sanitized request context (ingredients, filters, text length)
 * @param {string} [entry.fallbackAction=''] - Action taken (e.g. 'Local chef fallback', 'English fallback')
 * @returns {Object} The recorded log entry
 */
export function logAiFailure({
  service = 'UNKNOWN_AI_SERVICE',
  model = 'gemini-3.8-flash',
  error = null,
  context = {},
  fallbackAction = 'None'
} = {}) {
  const timestamp = new Date().toISOString();
  const errorMessage = error?.message || (typeof error === 'string' ? error : 'Unknown Gemini error');
  const errorStatus = error?.status || error?.code || 500;
  const sanitizedCtx = sanitizeContext(context);

  const logRecord = {
    timestamp,
    service,
    model,
    status: errorStatus,
    error: errorMessage,
    context: sanitizedCtx,
    fallbackAction
  };

  // 1. Maintain in-memory ring buffer
  recentFailures.unshift(logRecord);
  if (recentFailures.length > MAX_BUFFER_SIZE) {
    recentFailures.pop();
  }

  // 2. Structured Console Logging (visible in server terminal and Render runtime logs)
  console.error(`\n❌ [GEMINI_API_FAILURE] [${timestamp}]`);
  console.error(`   Service:  ${service} (Model: ${model})`);
  console.error(`   Status:   ${errorStatus}`);
  console.error(`   Error:    ${errorMessage}`);
  console.error(`   Context:  ${JSON.stringify(sanitizedCtx)}`);
  console.error(`   Fallback: ${fallbackAction}\n`);

  // 3. Persistent log file append
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    const logLine = `${JSON.stringify(logRecord)}\n`;
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
  } catch (fileErr) {
    // Never crash the server process if disk write fails
    console.warn('⚠️ Could not write to gemini_failures.log file:', fileErr.message);
  }

  return logRecord;
}

/**
 * Returns recent failures from the in-memory buffer.
 * @param {number} [limit=50]
 */
export function getRecentAiFailures(limit = 50) {
  return recentFailures.slice(0, limit);
}

/**
 * Clears the in-memory failures buffer (useful for test isolation).
 */
export function clearRecentAiFailures() {
  recentFailures.length = 0;
}
