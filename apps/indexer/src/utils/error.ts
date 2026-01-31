/**
 * Formats an error for structured logging
 * Extracts message, stack, and name from Error objects
 * Handles non-Error values by converting to string
 */
export function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  return {
    error: String(error),
    type: typeof error,
  };
}
