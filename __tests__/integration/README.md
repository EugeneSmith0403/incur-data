# Integration Tests

This directory contains integration tests for the incur-data project that use dockerized services (ClickHouse, Redis, RabbitMQ).

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ and pnpm

## Running Integration Tests

### 1. Start Test Services

```bash
# From the project root
cd __tests__/integration
docker-compose -f docker-compose.test.yml up -d
```

Wait for all services to be healthy (usually 10-30 seconds).

### 2. Run Integration Tests

```bash
# From the project root
pnpm test:integration
```

### 3. Stop Test Services

```bash
cd __tests__/integration
docker-compose -f docker-compose.test.yml down -v
```

The `-v` flag removes volumes to ensure a clean state for next run.

## Test Services

### ClickHouse
- **HTTP Port:** 8124 (instead of default 8123)
- **Native Port:** 9001 (instead of default 9000)
- **Database:** test_db
- **User:** test_user
- **Password:** test_password

### Redis
- **Port:** 6380 (instead of default 6379)
- **Password:** test_redis_password

### RabbitMQ
- **AMQP Port:** 5673 (instead of default 5672)
- **Management UI:** http://localhost:15673
- **User:** test_user
- **Password:** test_password
- **VHost:** test_vhost

## Test Structure

### Unit Tests
Located in individual packages:
- `packages/tx-parsing/__tests__/` - Transaction parsing tests
- `packages/dtos/__tests__/` - DTO validation tests

### Integration Tests
Located in `__tests__/integration/`:
- `clickhouse.integration.test.ts` - ClickHouse database tests
- `redis.integration.test.ts` - Redis caching tests
- `rabbitmq.integration.test.ts` - RabbitMQ messaging tests
- `setup.ts` - Test utilities and setup helpers

## Environment Variables

You can override test service configuration using environment variables:

```bash
# ClickHouse
TEST_CLICKHOUSE_HOST=http://localhost:8124
TEST_CLICKHOUSE_DB=test_db
TEST_CLICKHOUSE_USER=test_user
TEST_CLICKHOUSE_PASSWORD=test_password

# Redis
TEST_REDIS_HOST=localhost
TEST_REDIS_PORT=6380
TEST_REDIS_PASSWORD=test_redis_password

# RabbitMQ
TEST_RABBITMQ_URL=amqp://test_user:test_password@localhost:5673/test_vhost
```

## Writing New Integration Tests

1. Import setup utilities:
```typescript
import { setupTestServices, teardownTestServices, cleanTestData } from './setup.js';
```

2. Use the standard test structure:
```typescript
describe('My Integration Test', () => {
  let services: TestServices;

  beforeAll(async () => {
    services = await setupTestServices();
  }, 30000);

  afterAll(async () => {
    await teardownTestServices(services);
  });

  beforeEach(async () => {
    await cleanTestData(services);
  });

  it('should test something', async () => {
    // Your test code
  });
});
```

## Troubleshooting

### Services Not Starting

Check Docker logs:
```bash
docker-compose -f docker-compose.test.yml logs
```

### Port Conflicts

If you have services running on the test ports, either stop them or change the ports in `docker-compose.test.yml`.

### Tests Failing with Connection Errors

Ensure services are healthy:
```bash
docker-compose -f docker-compose.test.yml ps
```

All services should show "healthy" status.

### Cleaning Up

To completely remove test data and containers:
```bash
docker-compose -f docker-compose.test.yml down -v
rm -rf ./test-clickhouse-data
```

## CI/CD Integration

For CI/CD pipelines, you can use the wait functionality:

```typescript
import { waitForServices } from './setup.js';

beforeAll(async () => {
  await waitForServices(30, 1000); // Wait up to 30 seconds
  services = await setupTestServices();
}, 40000);
```

## Performance Considerations

- Integration tests are slower than unit tests
- Run them separately: `pnpm test:unit` vs `pnpm test:integration`
- Consider running integration tests only in CI or before releases
- Use `cleanTestData()` between tests to ensure isolation

## Test Data Fixtures

Fixtures for transaction parsing are located in:
- `packages/tx-parsing/__tests__/fixtures/`

These contain real Solana transaction structures for deterministic testing.
