# Application Package

TypeScript REST API with comprehensive Datadog observability integration (APM, tracing, logging).

## Overview

This package contains the application code for the Datadog Observability Playground. It's a REST API built with Express.js that demonstrates Datadog monitoring capabilities including APM, distributed tracing, structured logging, and runtime metrics.

## Features

- **CRUD Operations**: Full Create, Read, Update, Delete operations for products
- **Datadog Integration**:
  - APM (Application Performance Monitoring)
  - Distributed Tracing with dd-trace
  - Structured JSON logging with Pino
  - Log-trace correlation with trace ID injection
  - Runtime Metrics (CPU, memory, event loop)
  - Continuous Profiling
- **Scenario Simulation**: Test different application states (errors, latency, timeouts)
- **Production Best Practices**: TypeScript, health checks, graceful shutdown

## Quick Start

### From Monorepo Root

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev
```

### From This Directory

```bash
# Install dependencies (if not already done from root)
pnpm install

# Run in development mode
pnpm dev
```

### Docker Compose (Recommended)

```bash
export DD_API_KEY=your-datadog-api-key
docker-compose up
```

## Project Structure

```
packages/app/
├── src/
│   ├── index.ts                  # Entry point (loads tracer first!)
│   ├── tracer.ts                 # Datadog tracer initialization
│   ├── logger.ts                 # Pino logger with DD integration
│   ├── app.ts                    # Express app configuration
│   ├── server.ts                 # HTTP server
│   ├── data.ts                   # In-memory product data
│   ├── routes/
│   │   └── products.ts           # Product CRUD routes
│   └── utils/
│       └── scenarioSimulator.ts  # Scenario simulation middleware
├── Dockerfile                    # Multi-stage Docker build
├── docker-compose.yml            # Local development environment
├── package.json                  # Dependencies and scripts
└── README.md                     # This file
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

## Documentation

For detailed documentation, see the main docs directory:

- **[Getting Started Guide](../../docs/getting-started.md)** - Initial setup and first run
- **[Local Development Guide](../../docs/local-development.md)** - Development workflows
- **[API Reference](../../docs/api-reference.md)** - Complete API documentation
- **[Testing Guide](../../docs/testing.md)** - Testing scenarios and load generation
- **[Monitoring Guide](../../docs/monitoring.md)** - Datadog observability
- **[Troubleshooting](../../docs/troubleshooting.md)** - Common issues

## API Endpoints

### Health Check

```bash
GET /health
```

### Products CRUD

All endpoints support scenario simulation via `?scenario=<type>` query parameter.

```bash
GET    /api/products       # List all products
GET    /api/products/:id   # Get product by ID
POST   /api/products       # Create new product
PUT    /api/products/:id   # Update product
DELETE /api/products/:id   # Delete product
```

See **[API Reference](../../docs/api-reference.md)** for detailed endpoint documentation.

## Scenario Simulation

Test different application states by adding `?scenario=<type>` to any `/api/*` endpoint:

| Scenario | Description | Example |
|----------|-------------|---------|
| `normal` | No delay (default) | `?scenario=normal` |
| `error` | 400 Bad Request | `?scenario=error` |
| `internal-error` | 500 Internal Server Error | `?scenario=internal-error` |
| `long-latency` | 5 second delay | `?scenario=long-latency` |
| `random-latency` | Random 100ms-3s delay | `?scenario=random-latency` |
| `timeout` | 30 second delay | `?scenario=timeout` |

**Example**:
```bash
curl http://localhost:3000/api/products?scenario=long-latency
```

See **[Testing Guide](../../docs/testing.md)** for comprehensive testing examples.

## Environment Variables

Create a `.env` file in this directory:

```bash
# Application
PORT=3000
NODE_ENV=development

# Datadog
DD_SERVICE=test-datadog-crud-api
DD_ENV=local
DD_VERSION=1.0.0
DD_AGENT_HOST=localhost          # Use 'datadog-agent' for Docker Compose
DD_TRACE_AGENT_PORT=8126
DD_LOGS_INJECTION=true
DD_RUNTIME_METRICS_ENABLED=true
DD_PROFILING_ENABLED=true
```

## Docker

### Build Image

```bash
docker build -t test-datadog-crud-api:latest .
```

### Run Container

```bash
docker run -d \
  -p 3000:3000 \
  -e DD_AGENT_HOST=host.docker.internal \
  -e DD_API_KEY=your-key \
  test-datadog-crud-api:latest
```

### Docker Compose

```bash
export DD_API_KEY=your-datadog-api-key
docker-compose up
```

## Monitoring

After running the application, view telemetry in Datadog:

- **APM → Services**: https://app.datadoghq.com/apm/services
- **Traces**: https://app.datadoghq.com/apm/traces
- **Logs**: https://app.datadoghq.com/logs
- **Infrastructure**: https://app.datadoghq.com/infrastructure

Filter by: `service:test-datadog-crud-api`

See **[Monitoring Guide](../../docs/monitoring.md)** for detailed Datadog usage.

## Architecture

### Key Components

1. **Tracer** (`tracer.ts`): Initializes Datadog APM (must load first!)
2. **Logger** (`logger.ts`): Structured logging with trace correlation
3. **Express App** (`app.ts`): REST API with middleware stack
4. **Scenario Simulator** (`scenarioSimulator.ts`): Testing middleware
5. **Data Layer** (`data.ts`): In-memory product storage

### Request Flow

```
Request → Express → Tracer → Logger → Simulator → Route → Data → Response
```

See **[Architecture Guide](../../docs/architecture.md)** for detailed system design.

## Troubleshooting

### Application Won't Start

```bash
# Clean and reinstall
rm -rf node_modules dist
pnpm install
pnpm build
```

### No Data in Datadog

```bash
# Check agent status
docker exec datadog-agent agent status

# Enable debug logging
export DD_TRACE_DEBUG=true
pnpm dev
```

### Port Already in Use

```bash
# Find and kill process using port 3000
lsof -i :3000
kill -9 <PID>
```

See **[Troubleshooting Guide](../../docs/troubleshooting.md)** for complete troubleshooting documentation.

## Learn More

- **[Main README](../../README.md)** - Monorepo overview
- **[CDK Package](../cdk/README.md)** - Infrastructure package
- **[Datadog Documentation](https://docs.datadoghq.com/)** - Official Datadog docs

## License

MIT
