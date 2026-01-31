# DLN Analytics API

A production-ready Fastify API with TypeScript and Zod validation for querying DLN (DeBridge Liquidity Network) transaction data.

## Features

- ✅ **TypeScript** - Full type safety with TypeScript
- ✅ **Zod Validation** - Request/response validation with Zod schemas
- ✅ **Fastify** - High-performance web framework
- ✅ **OpenAPI/Swagger** - Auto-generated API documentation
- ✅ **ClickHouse Integration** - OLAP database for analytics
- ✅ **Redis Caching** - Response caching for performance
- ✅ **Error Handling** - Centralized error handling with proper status codes
- ✅ **Rate Limiting** - Built-in rate limiting protection
- ✅ **CORS** - Configurable CORS support
- ✅ **Health Checks** - Service health monitoring

## Quick Start

### Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Development mode with hot reload
pnpm dev

# Production mode
pnpm start
```

### Environment Variables

Create a `.env` file in the `apps/api` directory:

```env
# Server Configuration
NODE_ENV=development
LOG_LEVEL=info
API_PORT=3000
API_HOST=0.0.0.0
API_CORS_ORIGIN=*
API_RATE_LIMIT=100

# ClickHouse Configuration
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DATABASE=dln
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# Metrics
ENABLE_METRICS=true
METRICS_PORT=9090
```

## API Endpoints

### System Endpoints

#### Health Check
```http
GET /health
```

Check the health status of the API and its dependencies.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-26T10:00:00.000Z",
  "services": {
    "clickhouse": true,
    "redis": true
  },
  "version": "1.0.0"
}
```

**Status Codes:**
- `200` - All services healthy
- `503` - Service unhealthy or degraded

---

### Analytics Endpoints

#### Get Daily Volume
```http
GET /analytics/daily-volume
```

Get daily USD volume aggregated by event type (created vs fulfilled).

**Query Parameters:**
- `from_date` (string, optional) - Start date in YYYY-MM-DD format
- `to_date` (string, optional) - End date in YYYY-MM-DD format
- `event_type` (enum, optional) - Filter by `created` or `fulfilled`
- `give_chain_id` (string, optional) - Filter by source chain ID
- `take_chain_id` (string, optional) - Filter by destination chain ID
- `limit` (integer, optional) - Max results (default: 100, max: 1000)

**Example Request:**
```bash
curl "http://localhost:3000/analytics/daily-volume?from_date=2026-01-01&to_date=2026-01-26&limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-01-26",
      "eventType": "created",
      "giveChainId": "7565164",
      "takeChainId": "1",
      "totalVolumeUsd": "125000.50",
      "orderCount": 42,
      "avgOrderUsd": "2976.20",
      "minOrderUsd": "100.00",
      "maxOrderUsd": "50000.00",
      "uniqueMakers": 38,
      "uniqueOrders": 42,
      "lastUpdated": "2026-01-26T10:00:00.000Z"
    }
  ],
  "count": 1,
  "filters": {
    "from_date": "2026-01-01",
    "to_date": "2026-01-26",
    "limit": 10
  }
}
```

---

#### Get Volume Stats
```http
GET /analytics/stats
```

Get aggregated volume statistics for a time range.

**Query Parameters:**
- `from_date` (string, optional) - Start date in YYYY-MM-DD format
- `to_date` (string, optional) - End date in YYYY-MM-DD format
- `event_type` (enum, optional) - Filter by `created` or `fulfilled`
- `give_chain_id` (string, optional) - Filter by source chain ID
- `take_chain_id` (string, optional) - Filter by destination chain ID

**Example Request:**
```bash
curl "http://localhost:3000/analytics/stats?from_date=2026-01-01&event_type=created"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalVolumeUsd": "5250000.00",
    "orderCount": 1842,
    "avgOrderUsd": "2850.16",
    "minOrderUsd": "50.00",
    "maxOrderUsd": "100000.00",
    "uniqueMakers": 450,
    "uniqueOrders": 1842,
    "dateRange": {
      "from": "2026-01-01",
      "to": "2026-01-26"
    }
  },
  "filters": {
    "from_date": "2026-01-01",
    "event_type": "created"
  }
}
```

---

#### Get Volume Summary
```http
GET /analytics/summary
```

Get daily volume summary with created vs fulfilled comparison.

**Query Parameters:**
- `from_date` (string, optional) - Start date in YYYY-MM-DD format
- `to_date` (string, optional) - End date in YYYY-MM-DD format
- `give_chain_id` (string, optional) - Filter by source chain ID
- `take_chain_id` (string, optional) - Filter by destination chain ID
- `limit` (integer, optional) - Max results (default: 100, max: 1000)

**Example Request:**
```bash
curl "http://localhost:3000/analytics/summary?from_date=2026-01-20&limit=7"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-01-26",
      "giveChainId": "7565164",
      "takeChainId": "1",
      "createdVolumeUsd": "125000.50",
      "createdCount": 42,
      "createdAvgUsd": "2976.20",
      "fulfilledVolumeUsd": "118000.00",
      "fulfilledCount": 40,
      "fulfilledAvgUsd": "2950.00",
      "fulfillmentRate": 0.9524,
      "totalVolumeUsd": "243000.50",
      "uniqueMakers": 38,
      "lastUpdated": "2026-01-26T10:00:00.000Z"
    }
  ],
  "count": 1,
  "filters": {
    "from_date": "2026-01-20",
    "limit": 7
  }
}
```

---

#### Get Volume Comparison
```http
GET /analytics/comparison
```

Compare created and fulfilled volumes with unfulfilled metrics.

**Query Parameters:**
- `from_date` (string, optional) - Start date in YYYY-MM-DD format
- `to_date` (string, optional) - End date in YYYY-MM-DD format
- `give_chain_id` (string, optional) - Filter by source chain ID
- `take_chain_id` (string, optional) - Filter by destination chain ID
- `limit` (integer, optional) - Max results (default: 100, max: 1000)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-01-26",
      "giveChainId": "7565164",
      "takeChainId": "1",
      "created": {
        "volumeUsd": "125000.50",
        "count": 42,
        "avgUsd": "2976.20"
      },
      "fulfilled": {
        "volumeUsd": "118000.00",
        "count": 40,
        "avgUsd": "2950.00"
      },
      "fulfillmentRate": 0.9524,
      "unfulfilled": {
        "volumeUsd": "7000.50",
        "count": 2
      }
    }
  ],
  "count": 1
}
```

---

#### Get Volume Time Series
```http
GET /analytics/timeseries
```

Get volume time series data for charts.

**Query Parameters:**
- `from_date` (string, optional) - Start date in YYYY-MM-DD format
- `to_date` (string, optional) - End date in YYYY-MM-DD format
- `give_chain_id` (string, optional) - Filter by source chain ID
- `take_chain_id` (string, optional) - Filter by destination chain ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2026-01-26",
      "created": 125000.50,
      "fulfilled": 118000.00,
      "count": 42
    },
    {
      "timestamp": "2026-01-25",
      "created": 98000.00,
      "fulfilled": 95000.00,
      "count": 35
    }
  ],
  "count": 2
}
```

---

#### Get Top Token Pairs
```http
GET /analytics/top-tokens
```

Get top token pairs ranked by volume.

**Query Parameters:**
- `from_date` (string, optional) - Start date in YYYY-MM-DD format
- `to_date` (string, optional) - End date in YYYY-MM-DD format
- `event_type` (enum, optional) - Filter by `created` or `fulfilled`
- `limit` (integer, optional) - Max results (default: 20, max: 1000)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "giveTokenAddress": "So11111111111111111111111111111111111111112",
      "takeTokenAddress": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "giveChainId": "7565164",
      "takeChainId": "1",
      "totalVolumeUsd": "1500000.00",
      "orderCount": 450,
      "avgOrderUsd": "3333.33",
      "volumeShare": 28.57
    }
  ],
  "count": 1
}
```

---

#### Get Volume by Chain
```http
GET /analytics/by-chain
```

Get volume distribution across chains.

**Query Parameters:**
- `from_date` (string, optional) - Start date in YYYY-MM-DD format
- `to_date` (string, optional) - End date in YYYY-MM-DD format

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "giveChainId": "7565164",
      "takeChainId": "1",
      "createdVolumeUsd": "2500000.00",
      "fulfilledVolumeUsd": "2400000.00",
      "orderCount": 850,
      "volumeShare": 47.62
    }
  ],
  "count": 1
}
```

---

### Legacy Volume Endpoints

The API also provides legacy endpoints under `/api/v1/volume/*` for backward compatibility. See [volume.routes.ts](./src/routes/volume.routes.ts) for details.

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "statusCode": 400,
  "timestamp": "2026-01-26T10:00:00.000Z",
  "path": "/analytics/daily-volume",
  "details": [
    {
      "path": "from_date",
      "message": "Invalid date format",
      "code": "invalid_string"
    }
  ]
}
```

### Error Types

- `VALIDATION_ERROR` (400) - Invalid request parameters
- `NOT_FOUND` (404) - Resource or endpoint not found
- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Insufficient permissions
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests
- `DATABASE_ERROR` (500) - Database query failed
- `EXTERNAL_SERVICE_ERROR` (503) - External service unavailable
- `INTERNAL_SERVER_ERROR` (500) - Unexpected server error

## API Documentation

Interactive API documentation is available at:

```
http://localhost:3000/docs
```

This provides a Swagger UI interface where you can:
- Browse all available endpoints
- See request/response schemas
- Try out API calls directly
- View example requests and responses

## Architecture

### Technology Stack

- **Fastify** - Web framework
- **TypeScript** - Type safety
- **Zod** - Runtime validation
- **ClickHouse** - OLAP database
- **Redis** - Caching layer
- **Pino** - Structured logging

### Project Structure

```
apps/api/
├── src/
│   ├── config.ts                 # Configuration management
│   ├── index.ts                  # Application entry point
│   ├── middleware/
│   │   ├── error-handler.middleware.ts
│   │   └── validation.middleware.ts
│   ├── routes/
│   │   ├── analytics.routes.ts   # Analytics endpoints
│   │   └── volume.routes.ts      # Legacy volume endpoints
│   ├── schemas/
│   │   └── volume.schema.ts      # Zod validation schemas
│   └── services/
│       └── volume-aggregation.service.ts
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

### Shared Packages

The API uses shared packages from the monorepo:

- `@incur-data/dtos` - Shared DTOs with Zod schemas
- `@incur-data/olap-types` - ClickHouse table types and query helpers

## Performance

### Caching Strategy

- Redis caching with configurable TTL (default: 5 minutes)
- Cache keys include query parameters for granular invalidation
- Cache can be disabled via environment variable

### Query Optimization

- Uses ClickHouse materialized views for fast aggregations
- Fallback to query-time aggregation if MVs unavailable
- Configurable query limits to prevent excessive data transfer

### Rate Limiting

- Default: 100 requests per minute per IP
- Configurable via `API_RATE_LIMIT` environment variable
- Returns `429 Too Many Requests` when exceeded

## Development

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage
```

### Type Checking

```bash
# Check types
pnpm type-check

# Watch mode
pnpm type-check --watch
```

### Linting

```bash
# Lint code
pnpm lint

# Fix issues
pnpm lint:fix
```

## Deployment

### Docker

```bash
# Build Docker image
docker build -t dln-api:latest .

# Run container
docker run -p 3000:3000 --env-file .env dln-api:latest
```

### Docker Compose

The API is included in the root `docker-compose.yml`:

```bash
# Start all services
docker-compose up -d

# View API logs
docker-compose logs -f api
```

## Monitoring

### Health Checks

Use the `/health` endpoint for:
- Kubernetes liveness/readiness probes
- Load balancer health checks
- Service monitoring

### Metrics

Prometheus metrics are available on port 9090 (if enabled):

```
http://localhost:9090/metrics
```

### Logging

Structured JSON logs are written to stdout:
- Request/response logs
- Error logs with stack traces
- Performance metrics
- Database query logs

## Security

### Best Practices

- Rate limiting enabled by default
- CORS configured per environment
- Input validation with Zod
- SQL injection prevention via parameterized queries
- No sensitive data in logs

### Environment-Specific Configuration

**Development:**
- Pretty-printed logs
- Relaxed CORS
- Swagger UI enabled

**Production:**
- JSON logs
- Strict CORS
- Swagger UI can be disabled
- Enhanced security headers

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Change API_PORT in .env
API_PORT=3001
```

**ClickHouse connection failed:**
```bash
# Verify ClickHouse is running
docker-compose ps clickhouse

# Check connection
curl http://localhost:8123/ping
```

**Redis connection failed:**
```bash
# Verify Redis is running
docker-compose ps redis

# Test connection
redis-cli ping
```

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
```

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [your-repo/issues](https://github.com/your-repo/issues)
- Documentation: [docs link]
