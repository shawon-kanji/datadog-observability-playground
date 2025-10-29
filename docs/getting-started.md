# Getting Started

This guide will help you get the Datadog Observability Playground up and running in minutes.

## Prerequisites

- **Node.js** 18+ installed
- **pnpm** 8+ installed (`npm install -g pnpm`)
- **Docker** (for containerized setup)
- **Datadog account** and API key

## Get Your Datadog API Key

1. Go to https://app.datadoghq.com/ (create a free account if needed)
2. Navigate to: **Organization Settings** → **API Keys**
3. Copy your API key or create a new one

## Installation

From the repository root:

```bash
# Install all dependencies for all packages
pnpm install
```

## Quick Start Options

### Option 1: Docker Compose (Recommended)

Easiest way to get started with full Datadog integration:

```bash
# Navigate to app directory
cd packages/app

# Set your API key
export DD_API_KEY=your-datadog-api-key

# Start everything
docker-compose up

# Test the API (in another terminal)
curl http://localhost:3000/api/products
```

### Option 2: Local Node.js with pnpm

Run the application using pnpm from the monorepo root:

```bash
# From repository root
pnpm dev

# Or run from the app directory
cd packages/app
pnpm dev
```

**Note**: Without the Datadog agent running, the app will work but won't send telemetry to Datadog.

### Option 3: Local Node.js + Dockerized Datadog Agent

Best for development - app runs natively with fast restarts:

```bash
# Start Datadog agent in Docker
docker run -d --name datadog-agent \
  -e DD_API_KEY=your-key \
  -e DD_SITE=datadoghq.com \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -p 8126:8126 -p 8125:8125/udp \
  gcr.io/datadoghq/agent:latest

# Run application from root
pnpm dev
```

## Verify Everything Works

### 1. Check Application Health

```bash
# Health check
curl http://localhost:3000/health
# Expected: {"status":"healthy",...}

# Get all products
curl http://localhost:3000/api/products
# Expected: {"success":true,"count":5,...}
```

### 2. Check Datadog Agent Status

**Docker Compose:**
```bash
docker-compose -f packages/app/docker-compose.yml exec datadog-agent agent status
```

**Standalone Docker:**
```bash
docker exec datadog-agent agent status
```

Look for:
- ✅ API Key: Valid
- ✅ APM Agent: Running
- ✅ Logs Agent: Running

### 3. Test Scenarios

```bash
# Normal request
curl http://localhost:3000/api/products

# Trigger an error (400)
curl http://localhost:3000/api/products?scenario=error

# Test latency (5 seconds)
curl http://localhost:3000/api/products?scenario=long-latency
```

## View Data in Datadog

After running some requests, view your data:

1. **APM → Services**: https://app.datadoghq.com/apm/services
   - Find service: `test-datadog-crud-api`
   - View request rate, latency, and errors

2. **Logs**: https://app.datadoghq.com/logs
   - Filter by: `service:test-datadog-crud-api`
   - Notice trace IDs in logs

3. **Infrastructure**: https://app.datadoghq.com/infrastructure
   - View container/host metrics

**Note**: Data may take 1-2 minutes to appear in Datadog.

## Next Steps

- [Local Development Guide](./local-development.md) - Learn about different development workflows
- [API Reference](./api-reference.md) - Explore all API endpoints
- [Testing Guide](./testing.md) - Learn how to test different scenarios
- [Monitoring Guide](./monitoring.md) - Deep dive into Datadog features
- [Deployment Guide](./deployment.md) - Deploy to AWS ECS

## Common Issues

See the [Troubleshooting Guide](./troubleshooting.md) for solutions to common problems.

## Stopping the Application

**Docker Compose:**
```bash
docker-compose -f packages/app/docker-compose.yml down
```

**Local Node.js + Docker Agent:**
```bash
# Stop app: Ctrl+C in terminal
# Stop agent:
docker stop datadog-agent
docker rm datadog-agent
```
