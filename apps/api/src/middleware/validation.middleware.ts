/**
 * Zod validation middleware for Fastify
 * Provides centralized request validation and error handling
 */

import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { z, ZodError, ZodSchema } from 'zod';

/**
 * Create a validation hook for query parameters
 */
export function validateQueryParams<T extends ZodSchema>(schema: T) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ) => {
    try {
      request.query = schema.parse(request.query);
      done();
    } catch (error) {
      if (error instanceof ZodError) {
        reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
          statusCode: 400,
        });
      } else {
        reply.status(500).send({
          success: false,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred during validation',
          statusCode: 500,
        });
      }
    }
  };
}

/**
 * Create a validation hook for request body
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ) => {
    try {
      request.body = schema.parse(request.body);
      done();
    } catch (error) {
      if (error instanceof ZodError) {
        reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Invalid request body',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
          statusCode: 400,
        });
      } else {
        reply.status(500).send({
          success: false,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred during validation',
          statusCode: 500,
        });
      }
    }
  };
}

/**
 * Create a validation hook for URL parameters
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ) => {
    try {
      request.params = schema.parse(request.params);
      done();
    } catch (error) {
      if (error instanceof ZodError) {
        reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Invalid URL parameters',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
          statusCode: 400,
        });
      } else {
        reply.status(500).send({
          success: false,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred during validation',
          statusCode: 500,
        });
      }
    }
  };
}

/**
 * Global error handler for Zod validation errors
 */
export function handleZodError(error: Error, reply: FastifyReply) {
  if (error instanceof ZodError) {
    reply.status(400).send({
      success: false,
      error: 'Validation Error',
      message: 'Request validation failed',
      details: error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
      statusCode: 400,
      timestamp: new Date().toISOString(),
    });
    return true;
  }
  return false;
}

/**
 * Type-safe query parameter parser with Zod
 */
export function parseQuery<T extends ZodSchema>(
  query: unknown,
  schema: T
): z.infer<T> {
  return schema.parse(query);
}

/**
 * Type-safe body parser with Zod
 */
export function parseBody<T extends ZodSchema>(
  body: unknown,
  schema: T
): z.infer<T> {
  return schema.parse(body);
}

/**
 * Safe parser that returns result object instead of throwing
 */
export function safeParseQuery<T extends ZodSchema>(
  query: unknown,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: ZodError } {
  const result = schema.safeParse(query);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
