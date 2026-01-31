/**
 * Sanitization Utilities
 * Redact sensitive information from logs and errors
 */

const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'pwd',
  'token',
  'secret',
  'key',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'credential',
  'private',
];

/**
 * Check if a key name suggests sensitive data
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some(sensitiveKey => lowerKey.includes(sensitiveKey));
}

/**
 * Sanitize an object by redacting sensitive fields
 * @param obj - Object to sanitize
 * @param maxDepth - Maximum recursion depth (default: 3)
 * @returns Sanitized object with sensitive fields redacted
 */
export function sanitizeObject(
  obj: Record<string, unknown> | unknown[] | unknown,
  maxDepth = 3
): unknown {
  // Prevent deep recursion
  if (maxDepth <= 0) {
    return '[Max Depth Reached]';
  }

  // Handle null, undefined, primitives
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, maxDepth - 1));
  }

  // Handle objects
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, maxDepth - 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize query parameters for logging
 */
export function sanitizeQueryParams(
  query: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!query) {
    return undefined;
  }

  return sanitizeObject(query) as Record<string, unknown>;
}

/**
 * Sanitize request body for logging
 * Note: In most cases, request body should NOT be logged at all
 * This is a fallback for development/debugging
 */
export function sanitizeRequestBody(
  body: Record<string, unknown> | undefined
): string {
  if (!body) {
    return '[Empty Body]';
  }

  // Completely redact body in production
  if (process.env.NODE_ENV === 'production') {
    return '[Body Redacted - Production]';
  }

  // In development, sanitize sensitive fields
  const sanitized = sanitizeObject(body);
  return JSON.stringify(sanitized);
}
