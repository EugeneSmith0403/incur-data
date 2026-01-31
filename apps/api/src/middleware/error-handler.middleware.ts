/**
 * Centralized error handling middleware
 * Provides consistent error responses across the API
 */

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { sanitizeQueryParams } from '../utils/sanitize.js';

/**
 * Custom API error class
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: Record<string, unknown> | unknown[]
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Error type classification
 */
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMIT = 'RATE_LIMIT_EXCEEDED',
  DATABASE = 'DATABASE_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL = 'INTERNAL_SERVER_ERROR',
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path?: string;
  details?: Record<string, unknown> | unknown[];
}

/**
 * Global error handler
 */
export async function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const timestamp = new Date().toISOString();
  const path = request.url;

  // Log the error (with sanitized request data)
  request.log.error({
    error,
    path,
    method: request.method,
    query: sanitizeQueryParams(request.query as Record<string, unknown>),
    // Do not log request body for security - contains sensitive data
  });

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const response: ErrorResponse = {
      success: false,
      error: ErrorType.VALIDATION,
      message: 'Request validation failed',
      statusCode: 400,
      timestamp,
      path,
      details: error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    };
    return reply.status(400).send(response);
  }

  // Handle custom API errors
  if (error instanceof ApiError) {
    const response: ErrorResponse = {
      success: false,
      error: ErrorType.INTERNAL,
      message: error.message,
      statusCode: error.statusCode,
      timestamp,
      path,
      details: error.details,
    };
    return reply.status(error.statusCode).send(response);
  }

  // Handle Fastify errors
  if ('statusCode' in error) {
    const fastifyError = error as FastifyError;
    const statusCode = fastifyError.statusCode || 500;

    let errorType = ErrorType.INTERNAL;
    if (statusCode === 404) errorType = ErrorType.NOT_FOUND;
    else if (statusCode === 401) errorType = ErrorType.UNAUTHORIZED;
    else if (statusCode === 403) errorType = ErrorType.FORBIDDEN;
    else if (statusCode === 429) errorType = ErrorType.RATE_LIMIT;
    else if (statusCode >= 400 && statusCode < 500) errorType = ErrorType.VALIDATION;

    const response: ErrorResponse = {
      success: false,
      error: errorType,
      message: fastifyError.message || 'An error occurred',
      statusCode,
      timestamp,
      path,
    };

    return reply.status(statusCode).send(response);
  }

  // Handle generic errors
  const response: ErrorResponse = {
    success: false,
    error: ErrorType.INTERNAL,
    message: error.message || 'Internal server error',
    statusCode: 500,
    timestamp,
    path,
  };

  return reply.status(500).send(response);
}

/**
 * Create a not found error
 */
export function createNotFoundError(resource: string): ApiError {
  return new ApiError(404, `${resource} not found`);
}

/**
 * Create a validation error
 */
export function createValidationError(message: string, details?: Record<string, unknown> | unknown[]): ApiError {
  return new ApiError(400, message, details);
}

/**
 * Create a database error
 */
export function createDatabaseError(message: string, details?: Record<string, unknown> | unknown[]): ApiError {
  return new ApiError(500, `Database error: ${message}`, details);
}

/**
 * Create an external service error
 */
export function createExternalServiceError(service: string, details?: Record<string, unknown> | unknown[]): ApiError {
  return new ApiError(503, `External service error: ${service}`, details);
}

/**
 * Not found handler for undefined routes
 */
export async function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const response: ErrorResponse = {
    success: false,
    error: ErrorType.NOT_FOUND,
    message: `Route ${request.method} ${request.url} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
    path: request.url,
  };

  return reply.status(404).send(response);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T>(
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<T>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await handler(request, reply);
    } catch (error) {
      return errorHandler(error as Error, request, reply);
    }
  };
}
