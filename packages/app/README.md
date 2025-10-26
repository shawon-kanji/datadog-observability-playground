# Test Datadog CRUD API

A TypeScript-based REST API with full Datadog integration for APM, logging, and tracing. This application includes scenario simulation capabilities to test various monitoring scenarios in Datadog, perfect for practicing site reliability engineering.

## Features

- **CRUD Operations**: Full Create, Read, Update, Delete operations for products
- **Datadog Integration**:
  - APM (Application Performance Monitoring)
  - Distributed Tracing
  - Log Injection with trace correlation
  - Runtime Metrics
  - Continuous Profiling
- **Scenario Simulation**: Test different application states
  - Client errors (400)
  - Internal server errors (500)
  - Long latency (5 seconds)
  - Random latency (100ms - 3s)
  - Timeout scenarios (30 seconds)
- **ECS Ready**: Includes Docker and AWS ECS deployment configurations
- **Production Best Practices**: TypeScript, structured logging, health checks, graceful shutdown

## Quick Start

### From Monorepo Root

```bash
# Install dependencies (from repo root)
pnpm install

# Run in development mode
pnpm dev

# Or run from this directory
cd packages/app
pnpm dev
```

### Local Development Options

#### Option 1: Docker Compose (Recommended)

```bash
export DD_API_KEY=your-datadog-api-key
docker-compose up
```

#### Option 2: Local Node.js + Dockerized Agent

```bash
# Start Datadog agent
docker run -d --name datadog-agent \
  -e DD_API_KEY=your-key \
  -e DD_SITE=datadoghq.com \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -p 8126:8126 -p 8125:8125/udp \
  gcr.io/datadoghq/agent:latest

# Run application
pnpm dev
```


## Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# Application
PORT=3000
NODE_ENV=development

# Datadog
DD_SERVICE=test-datadog-crud-api
DD_ENV=dev
DD_VERSION=1.0.0
DD_AGENT_HOST=localhost  # or datadog-agent for Docker
DD_TRACE_AGENT_PORT=8126
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Products CRUD

All endpoints support scenario simulation via query parameter:

#### Get All Products
```bash
GET /api/products
GET /api/products?scenario=long-latency
```

#### Get Product by ID
```bash
GET /api/products/:id
GET /api/products/1?scenario=random-latency
```

#### Create Product
```bash
POST /api/products
Content-Type: application/json

{
  "name": "New Product",
  "price": 99.99,
  "category": "Electronics",
  "stock": 100
}
```

#### Update Product
```bash
PUT /api/products/:id
Content-Type: application/json

{
  "name": "Updated Product",
  "price": 149.99
}
```

#### Delete Product
```bash
DELETE /api/products/:id
```

## Scenario Simulation

Add `?scenario=<type>` to any `/api/*` endpoint to simulate different states:

| Scenario | Description | Example |
|----------|-------------|---------|
| `normal` | No delay (default) | `/api/products?scenario=normal` |
| `error` | 400 Bad Request | `/api/products?scenario=error` |
| `internal-error` | 500 Internal Server Error | `/api/products?scenario=internal-error` |
| `long-latency` | 5 second delay | `/api/products?scenario=long-latency` |
| `random-latency` | Random 100ms-3s delay | `/api/products?scenario=random-latency` |
| `timeout` | 30 second delay | `/api/products?scenario=timeout` |

## Testing Scenarios

```bash
# Normal request
curl http://localhost:3000/api/products

# Trigger error
curl http://localhost:3000/api/products?scenario=error

# Trigger internal error
curl http://localhost:3000/api/products?scenario=internal-error

# Test latency
curl http://localhost:3000/api/products?scenario=long-latency

# Random latency
curl http://localhost:3000/api/products?scenario=random-latency

# Test batch requests
./test-scenarios.sh
```

## Project Structure

```
packages/app/
├── src/
│   ├── app.ts                      # Express app configuration
│   ├── server.ts                   # Server entry point
│   ├── index.ts                    # Main entry (starts server)
│   ├── tracer.ts                   # Datadog tracer initialization
│   ├── logger.ts                   # Custom logger with DD integration
│   ├── data.ts                     # Static product data
│   ├── routes/
│   │   └── products.ts             # Product CRUD routes
│   └── utils/
│       └── scenarioSimulator.ts    # Scenario simulation middleware
├── Dockerfile                      # Multi-stage Docker build
├── docker-compose.yml              # Local development with Datadog agent
├── package.json                    # Dependencies and scripts
└── tsconfig.json                   # TypeScript configuration
```

## Available Scripts

```bash
# Development
pnpm dev              # Run with nodemon and ts-node
pnpm dev:docker       # Run with Docker-specific settings

# Production
pnpm build            # Compile TypeScript to JavaScript
pnpm start            # Run compiled JavaScript

# Local execution
pnpm start:local      # Run with ts-node (no build)
```

## Docker Build

```bash
# Build image
docker build -t test-datadog-crud-api:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e DD_AGENT_HOST=host.docker.internal \
  -e DD_API_KEY=your-key \
  test-datadog-crud-api:latest
```

## Monitoring in Datadog

After deployment, explore these Datadog features:

1. **APM → Services**: Navigate to APM → Services → `test-datadog-crud-api`
2. **Traces**: View distributed traces with full request flow
3. **Logs**: Filter by `service:test-datadog-crud-api`
4. **Metrics**: Analyze latency percentiles (p50, p75, p95, p99)
5. **Profiling**: View CPU and memory profiling data

### Practice Scenarios

Generate traffic to test monitoring:

```bash
# Normal traffic
for i in {1..100}; do curl http://localhost:3000/api/products; done

# Generate errors
for i in {1..50}; do curl http://localhost:3000/api/products?scenario=error; done

# Generate latency issues
for i in {1..20}; do curl http://localhost:3000/api/products?scenario=long-latency & done
```

## Troubleshooting

### Datadog Agent Not Receiving Data

**Docker Compose:**
```bash
docker-compose exec datadog-agent agent status
```

**Standalone Docker:**
```bash
docker logs datadog-agent
```

### No Traces Appearing

1. Verify tracer initialization happens first (check `src/index.ts`)
2. Check environment variables are set correctly
3. Verify agent is reachable: `DD_AGENT_HOST` and `DD_TRACE_AGENT_PORT`
4. Check agent logs for connection errors

### Build Errors

```bash
# Clean and rebuild
rm -rf node_modules dist
pnpm install
pnpm build
```

### Port Already in Use

```bash
# Stop containers
docker-compose down

# Or kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

## Additional Documentation

- **[GETTING_STARTED.md](GETTING_STARTED.md)**: Comprehensive getting started guide
- **[QUICKSTART.md](QUICKSTART.md)**: Quick reference for common tasks
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)**: API and command reference

## License

MIT
