/**
 * Analytics API routes with Zod validation
 * Provides clean endpoints for volume analytics
 */

import { FastifyInstance } from 'fastify';
import { VolumeAggregationService } from '../services/volume-aggregation.service.js';
import {
  volumeQuerySchema,
} from '../schemas/volume.schema.js';
import { parseQueryFilters } from '../utils/query-parser.js';

interface AnalyticsRouteContext {
  volumeService: VolumeAggregationService;
}

/**
 * Register analytics routes with Zod validation
 */
export async function registerAnalyticsRoutes(
  fastify: FastifyInstance,
  context: AnalyticsRouteContext
) {
  const { volumeService } = context;

  /**
   * GET /api/v1/analytics/daily-volume
   * Get daily USD volume with event type breakdown
   */
  fastify.get('/api/v1/analytics/daily-volume', {
    schema: {
      description: 'Get daily USD volume aggregated by event type (created vs fulfilled)',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          fromDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Start date (YYYY-MM-DD)' },
          toDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'End date (YYYY-MM-DD)' },
          eventType: { type: 'string', enum: ['created', 'fulfilled'], description: 'Filter by event type' },
          giveChainId: { type: 'string', description: 'Filter by source chain' },
          takeChainId: { type: 'string', description: 'Filter by destination chain' },
          limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100, description: 'Max results' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  eventType: { type: 'string', enum: ['created', 'fulfilled'] },
                  giveChainId: { type: 'string' },
                  takeChainId: { type: 'string' },
                  totalVolumeUsd: { type: 'string' },
                  orderCount: { type: 'integer' },
                  avgOrderUsd: { type: 'string' },
                  minOrderUsd: { type: 'string' },
                  maxOrderUsd: { type: 'string' },
                  uniqueMakers: { type: 'integer' },
                  uniqueOrders: { type: 'integer' },
                  lastUpdated: { type: 'string' },
                },
              },
            },
            count: { type: 'integer' },
            filters: { type: 'object' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        // Validate query parameters with Zod
        const validatedQuery = volumeQuerySchema.parse(request.query);
        const filters = parseQueryFilters(validatedQuery);

        // Fetch data from service
        const data = await volumeService.getDailyVolume(filters);

        return {
          success: true,
          data,
          count: data.length,
          filters: validatedQuery,
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'ZodError') {
          reply.status(400).send({
            success: false,
            error: 'Invalid query parameters',
            message: error.message,
            statusCode: 400,
          });
          return;
        }

        fastify.log.error(error);
        reply.status(500).send({
          success: false,
          error: 'Failed to fetch daily volume',
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: 500,
        });
      }
    },
  });

  /**
   * GET /api/v1/analytics/daily-volume-summary
   * Get daily volume summary with fulfillment metrics
   */
  fastify.get('/api/v1/analytics/daily-volume-summary', {
    schema: {
      description: 'Get daily volume summary with created vs fulfilled comparison',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          fromDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          toDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          giveChainId: { type: 'string' },
          takeChainId: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const validatedQuery = volumeQuerySchema.parse(request.query);
        const filters = parseQueryFilters(validatedQuery);

        const data = await volumeService.getDailyVolumeSummary(filters);

        return {
          success: true,
          data,
          count: data.length,
          filters: validatedQuery,
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'ZodError') {
          reply.status(400).send({
            success: false,
            error: 'Invalid query parameters',
            message: error.message,
            statusCode: 400,
          });
          return;
        }

        fastify.log.error(error);
        reply.status(500).send({
          success: false,
          error: 'Failed to fetch volume summary',
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: 500,
        });
      }
    },
  });

  /**
   * GET /api/v1/analytics/total-stats
   * Get total statistics for all time (created vs fulfilled)
   */
  fastify.get('/api/v1/analytics/total-stats', {
    schema: {
      description: 'Get total statistics for all time with created vs fulfilled breakdown',
      tags: ['Analytics'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                created: {
                  type: 'object',
                  properties: {
                    totalVolumeUsd: { type: 'string' },
                    orderCount: { type: 'integer' },
                    avgOrderUsd: { type: 'string' },
                  },
                },
                fulfilled: {
                  type: 'object',
                  properties: {
                    totalVolumeUsd: { type: 'string' },
                    orderCount: { type: 'integer' },
                    avgOrderUsd: { type: 'string' },
                  },
                },
                dateRange: {
                  type: 'object',
                  properties: {
                    from: { type: 'string' },
                    to: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    handler: async (_request, reply) => {
      try {
        const data = await volumeService.getTotalStats();

        return {
          success: true,
          data,
        };
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({
          success: false,
          error: 'Failed to fetch total stats',
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: 500,
        });
      }
    },
  });
}
