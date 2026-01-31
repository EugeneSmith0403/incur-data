# DLN Analytics API Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  (Browser, Mobile App, CLI, Other Services)                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTP/HTTPS
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     Fastify API Server                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Middleware Layer                              │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │ │
│  │  │  CORS    │ │   Rate   │ │   Zod    │ │    Error     │ │ │
│  │  │          │ │  Limit   │ │Validation│ │   Handler    │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Routes Layer                              │ │
│  │  ┌─────────────────┐         ┌──────────────────┐        │ │
│  │  │  /health        │         │  /analytics/*    │        │ │
│  │  │  - ClickHouse   │         │  - daily-volume  │        │ │
│  │  │  - Redis status │         │  - stats         │        │ │
│  │  └─────────────────┘         │  - summary       │        │ │
│  │                               │  - comparison    │        │ │
│  │  ┌─────────────────┐         │  - timeseries    │        │ │
│  │  │  /docs          │         │  - top-tokens    │        │ │
│  │  │  Swagger UI     │         │  - by-chain      │        │ │
│  │  └─────────────────┘         └──────────────────┘        │ │
│  │                                                            │ │
│  │  ┌─────────────────────────────────────────────┐         │ │
│  │  │  /api/v1/volume/* (Legacy Endpoints)        │         │ │
│  │  └─────────────────────────────────────────────┘         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Service Layer                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │       VolumeAggregationService                       │ │ │
│  │  │  - getDailyVolume()                                  │ │ │
│  │  │  - getVolumeStats()                                  │ │ │
│  │  │  - getDailyVolumeSummary()                           │ │ │
│  │  │  - getVolumeComparison()                             │ │ │
│  │  │  - getVolumeTimeSeries()                             │ │ │
│  │  │  - getTopTokenPairsByVolume()                        │ │ │
│  │  │  - getVolumeByChain()                                │ │ │
│  │  │  - Cache management                                  │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────┬───────────────────────────────┬──────────────┘
                   │                               │
                   │                               │
        ┌──────────▼──────────┐         ┌─────────▼─────────┐
        │   Redis Cache       │         │   ClickHouse      │
        │                     │         │   OLAP DB         │
        │  - Query cache      │         │                   │
        │  - 5 min TTL        │         │  - Raw events     │
        │  - Key-value store  │         │  - Enriched data  │
        └─────────────────────┘         │  - Materialized   │
                                        │    views          │
                                        │  - Aggregates     │
                                        └───────────────────┘
```

## Component Breakdown

### 1. Client Layer
- **Browser Applications** - Web frontends (React, Vue, etc.)
- **Mobile Applications** - iOS, Android apps
- **CLI Tools** - Command-line interfaces
- **Other Services** - Microservices, integrations

### 2. API Server (Fastify)

#### Middleware Stack
1. **CORS** - Cross-origin resource sharing
2. **Rate Limiting** - 100 req/min per IP (configurable)
3. **Zod Validation** - Request/response validation
4. **Error Handler** - Centralized error handling

#### Routes
- **System Routes**
  - `/health` - Health checks
  - `/docs` - Swagger UI

- **Analytics Routes** (New)
  - `/analytics/daily-volume` - Daily volume metrics
  - `/analytics/stats` - Aggregate statistics
  - `/analytics/summary` - Volume summary
  - `/analytics/comparison` - Created vs fulfilled
  - `/analytics/timeseries` - Chart data
  - `/analytics/top-tokens` - Top pairs
  - `/analytics/by-chain` - Chain distribution

- **Legacy Routes** (Preserved)
  - `/api/v1/volume/*` - Backward compatible endpoints

#### Services
- **VolumeAggregationService**
  - Query orchestration
  - Cache management
  - Data transformation
  - Fallback logic

### 3. Data Layer

#### Redis Cache
- **Purpose**: Response caching
- **TTL**: 5 minutes (configurable)
- **Keys**: Query-specific cache keys
- **Invalidation**: Manual via POST endpoint

#### ClickHouse Database
- **Raw Events**: Transaction logs
- **Enriched Orders**: Processed with USD prices
- **Materialized Views**: Pre-aggregated metrics
  - `daily_usd_volume_readable`
  - `daily_usd_volume_summary`
  - `daily_token_usd_volume_readable`
- **Aggregates**: Daily/hourly rollups

## Data Flow

### Request Flow (With Cache Hit)
```
Client → Fastify → Middleware → Route Handler
  ↓
VolumeAggregationService
  ↓
Redis Cache (HIT)
  ↓
Return cached data → Client
```

### Request Flow (With Cache Miss)
```
Client → Fastify → Middleware → Route Handler
  ↓
VolumeAggregationService
  ↓
Redis Cache (MISS)
  ↓
ClickHouse Query
  ↓
Transform Results
  ↓
Store in Redis → Return data → Client
```

### Error Flow
```
Error occurs
  ↓
Error Handler Middleware
  ↓
Classify error type
  ↓
Log error details
  ↓
Format error response
  ↓
Send HTTP error response → Client
```

## Type System

```
┌─────────────────────────────────────────────────────────────┐
│                   Type Safety Layers                         │
├─────────────────────────────────────────────────────────────┤
│  Request (Runtime) → Zod Schema → TypeScript Type           │
│                                                              │
│  packages/dtos/analytics.dto.ts (Shared)                    │
│    ├─ VolumeQueryFiltersDto                                 │
│    ├─ DailyVolumeResultDto                                  │
│    ├─ VolumeStatsResultDto                                  │
│    └─ ... more DTOs                                         │
│                                                              │
│  apps/api/schemas/volume.schema.ts (API-specific)           │
│    ├─ volumeQuerySchema (Zod)                               │
│    ├─ dailyVolumeResponseSchema (Zod)                       │
│    └─ ... more schemas                                      │
│                                                              │
│  packages/olap-types (Database)                             │
│    ├─ DailyUsdVolumeResult                                  │
│    ├─ VolumeStatsResult                                     │
│    └─ ... more OLAP types                                   │
└─────────────────────────────────────────────────────────────┘
```

## Request/Response Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Request Received                                          │
│    GET /analytics/daily-volume?from_date=2026-01-01         │
└──────────────────┬───────────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────────┐
│ 2. Middleware Processing                                     │
│    ✓ CORS headers applied                                   │
│    ✓ Rate limit check (100/min)                             │
│    ✓ Zod validation (query params)                          │
└──────────────────┬───────────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────────┐
│ 3. Route Handler                                             │
│    - Parse validated query                                   │
│    - Convert to VolumeQueryFilters                           │
│    - Call service method                                     │
└──────────────────┬───────────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────────┐
│ 4. Service Layer                                             │
│    - Build cache key                                         │
│    - Check Redis cache                                       │
│    - If miss: query ClickHouse                               │
│    - Transform results                                       │
│    - Store in cache                                          │
└──────────────────┬───────────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────────┐
│ 5. Response Formation                                        │
│    {                                                         │
│      success: true,                                          │
│      data: [ /* results */ ],                                │
│      count: 10,                                              │
│      filters: { /* applied */ }                              │
│    }                                                         │
└──────────────────┬───────────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────────┐
│ 6. Send Response                                             │
│    HTTP 200 OK                                               │
│    Content-Type: application/json                            │
└──────────────────────────────────────────────────────────────┘
```

## Caching Strategy

```
┌─────────────────────────────────────────────────────────────┐
│              Redis Cache Architecture                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Cache Key Format:                                          │
│  dln:cache:volume:{query_type}:{filter1}:{filter2}...       │
│                                                              │
│  Examples:                                                   │
│  - dln:cache:volume:daily:from:2026-01-01:to:2026-01-26     │
│  - dln:cache:volume:stats:type:created:chain:7565164        │
│  - dln:cache:volume:summary:from:2026-01-20:limit:10        │
│                                                              │
│  TTL: 300 seconds (5 minutes)                               │
│  Format: JSON string                                         │
│  Invalidation: Manual via /invalidate-cache endpoint        │
│                                                              │
│  Cache Hit Ratio Target: > 80%                              │
│  Average Response Time:                                      │
│    - Cache Hit:  < 10ms                                     │
│    - Cache Miss: 50-200ms                                   │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling

```
┌─────────────────────────────────────────────────────────────┐
│                   Error Classification                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  VALIDATION_ERROR (400)                                     │
│    - Invalid query parameters                                │
│    - Missing required fields                                 │
│    - Type mismatch                                           │
│                                                              │
│  NOT_FOUND (404)                                            │
│    - Unknown endpoint                                        │
│    - Resource not found                                      │
│                                                              │
│  RATE_LIMIT_EXCEEDED (429)                                  │
│    - Too many requests                                       │
│    - Retry after X seconds                                   │
│                                                              │
│  DATABASE_ERROR (500)                                       │
│    - ClickHouse query failed                                 │
│    - Connection issues                                       │
│                                                              │
│  EXTERNAL_SERVICE_ERROR (503)                               │
│    - Redis unavailable                                       │
│    - ClickHouse unavailable                                  │
│                                                              │
│  INTERNAL_SERVER_ERROR (500)                                │
│    - Unexpected errors                                       │
│    - Unhandled exceptions                                    │
└─────────────────────────────────────────────────────────────┘
```

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- Shared Redis cache
- Load balancer compatible
- No session storage

### Performance Optimization
- Materialized views in ClickHouse
- Redis caching layer
- Query result pagination
- Efficient SQL queries
- Connection pooling

### Monitoring
- Health check endpoint
- Structured logging
- Error tracking
- Performance metrics
- Request tracing

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Measures                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Input Validation                                        │
│     - Zod schema validation                                  │
│     - Type checking                                          │
│     - SQL injection prevention                               │
│                                                              │
│  2. Rate Limiting                                           │
│     - Per-IP limits                                          │
│     - Configurable thresholds                                │
│     - DDoS protection                                        │
│                                                              │
│  3. CORS                                                    │
│     - Origin whitelist                                       │
│     - Credentials handling                                   │
│     - Method restrictions                                    │
│                                                              │
│  4. Error Handling                                          │
│     - No stack traces in production                          │
│     - Sanitized error messages                               │
│     - Internal details hidden                                │
│                                                              │
│  5. Logging                                                 │
│     - No sensitive data                                      │
│     - Structured JSON logs                                   │
│     - Audit trail                                            │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Setup                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Load Balancer (Nginx/CloudFlare)                          │
│          │                                                   │
│          ├─► API Instance 1 (Container)                     │
│          ├─► API Instance 2 (Container)                     │
│          └─► API Instance N (Container)                     │
│                    │                                         │
│                    ├─► Redis Cluster                        │
│                    │    - Master/Replica                     │
│                    │    - High availability                  │
│                    │                                         │
│                    └─► ClickHouse Cluster                   │
│                         - Distributed tables                 │
│                         - Replication                        │
│                         - Sharding                           │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Node.js | JavaScript runtime |
| Framework | Fastify | High-performance web framework |
| Language | TypeScript | Type safety |
| Validation | Zod | Runtime schema validation |
| Database | ClickHouse | OLAP analytics database |
| Cache | Redis | In-memory cache |
| Logging | Pino | Structured logging |
| Documentation | Swagger/OpenAPI | API documentation |
| Container | Docker | Containerization |

## Future Enhancements

1. **Authentication & Authorization**
   - JWT tokens
   - API keys
   - Role-based access

2. **Advanced Caching**
   - Cache warming
   - Predictive caching
   - Multi-tier caching

3. **Real-time Features**
   - WebSocket support
   - Server-sent events
   - Live data updates

4. **Monitoring & Observability**
   - Prometheus metrics
   - OpenTelemetry tracing
   - APM integration

5. **API Versioning**
   - Version negotiation
   - Backward compatibility
   - Deprecation handling
