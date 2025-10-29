# Datadog Observability Playground

> TypeScript REST API with full Datadog observability integration (APM, tracing, logging). Practice monitoring, error tracking, and performance analysis in a pnpm monorepo.

## Overview

This is a pnpm monorepo containing:
- **Application** (`packages/app`): TypeScript REST API with Datadog integration
- **Infrastructure** (`packages/cdk`): AWS CDK code for ECS Fargate deployment
- **Documentation** (`docs/`): Comprehensive guides for setup, development, and deployment

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start application
pnpm dev

# 3. Test the API
curl http://localhost:3000/api/products
```

For detailed setup instructions, see the **[Getting Started Guide](docs/getting-started.md)**.

## Documentation

### Core Guides

- **[Getting Started](docs/getting-started.md)** - Set up the project and run your first request
- **[Local Development](docs/local-development.md)** - Development workflows with pnpm workspaces
- **[API Reference](docs/api-reference.md)** - Complete API endpoints documentation
- **[Testing Guide](docs/testing.md)** - Test scenarios and load generation
- **[Monitoring Guide](docs/monitoring.md)** - Datadog observability deep dive
- **[Deployment Guide](docs/deployment.md)** - Deploy to AWS ECS with CDK
- **[Architecture](docs/architecture.md)** - System design and architecture
- **[Commands Reference](docs/commands-reference.md)** - Quick command reference
- **[Troubleshooting](docs/troubleshooting.md)** - Common issues and solutions

### Package Documentation

- **[Application README](packages/app/README.md)** - Application package details
- **[CDK README](packages/cdk/README.md)** - Infrastructure package details

## Project Structure

```
datadog-observability-playground/
├── docs/                     # Consolidated documentation
│   ├── getting-started.md
│   ├── local-development.md
│   ├── api-reference.md
│   ├── testing.md
│   ├── monitoring.md
│   ├── deployment.md
│   ├── architecture.md
│   ├── commands-reference.md
│   └── troubleshooting.md
├── packages/
│   ├── app/                  # Application code
│   │   ├── src/             # TypeScript source files
│   │   ├── Dockerfile
│   │   └── package.json
│   └── cdk/                  # AWS CDK infrastructure
│       ├── bin/
│       ├── lib/
│       └── package.json
├── package.json              # Root monorepo configuration
├── pnpm-workspace.yaml       # pnpm workspace config
└── README.md                 # This file
```

## Features

### Application Features

- **CRUD API**: Full Create, Read, Update, Delete operations for products
- **Datadog Integration**:
  - APM (Application Performance Monitoring)
  - Distributed Tracing
  - Structured Logging with trace correlation
  - Runtime Metrics (CPU, memory, event loop)
  - Continuous Profiling
- **Scenario Simulation**: Test different states (errors, latency, timeouts)
- **Production-Ready**: TypeScript, health checks, graceful shutdown

### Infrastructure Features

- **AWS ECS Fargate**: Serverless container deployment
- **Application Load Balancer**: Public-facing HTTP load balancer
- **Auto-Scaling**: CPU/memory-based scaling (1-4 tasks)
- **CloudWatch Integration**: Centralized logging
- **Secrets Management**: Secure Datadog API key storage
- **Infrastructure as Code**: Full AWS CDK TypeScript implementation

## Available Commands

### From Repository Root

```bash
# Development
pnpm dev                    # Run app in development mode
pnpm build                  # Build application
pnpm build:all              # Build all packages

# Infrastructure
pnpm cdk:deploy             # Deploy to AWS
pnpm cdk:destroy            # Destroy AWS infrastructure
pnpm cdk:synth              # Synthesize CloudFormation
pnpm cdk:diff               # Show infrastructure changes

# Maintenance
pnpm clean                  # Clean build outputs
pnpm clean:all              # Clean everything
```

See **[Commands Reference](docs/commands-reference.md)** for complete command list.

## Development Workflows

### Option 1: Docker Compose (Recommended for Learning)

```bash
cd packages/app
export DD_API_KEY=your-datadog-api-key
docker-compose up
```

### Option 2: Local Node.js with pnpm

```bash
# From repository root
pnpm dev
```

### Option 3: Node.js + Dockerized Datadog Agent

```bash
# Terminal 1: Start agent
docker run -d --name datadog-agent \
  -e DD_API_KEY=your-key \
  -e DD_APM_ENABLED=true \
  -p 8126:8126 -p 8125:8125/udp \
  gcr.io/datadoghq/agent:latest

# Terminal 2: Start app
pnpm dev
```

See **[Local Development Guide](docs/local-development.md)** for detailed workflows.

## Testing Scenarios

The application supports scenario simulation for testing different monitoring conditions:

```bash
# Normal request
curl http://localhost:3000/api/products

# Trigger client error (400)
curl http://localhost:3000/api/products?scenario=error

# Trigger server error (500)
curl http://localhost:3000/api/products?scenario=internal-error

# Test latency (5 seconds)
curl http://localhost:3000/api/products?scenario=long-latency

# Random latency (100ms-3s)
curl http://localhost:3000/api/products?scenario=random-latency
```

See **[Testing Guide](docs/testing.md)** for comprehensive testing examples.

## Monitoring in Datadog

After deployment, explore these Datadog features:

1. **APM → Services**: View `test-datadog-crud-api` metrics and traces
2. **Logs**: Filter by `service:test-datadog-crud-api` for correlated logs
3. **Infrastructure**: Monitor ECS tasks, containers, and hosts
4. **Dashboards**: Create custom dashboards with key metrics
5. **Monitors**: Set up alerts for errors and latency

See **[Monitoring Guide](docs/monitoring.md)** for detailed Datadog usage.

## Deployment to AWS

```bash
# 1. Configure AWS
aws configure

# 2. Bootstrap CDK (first time only)
cd packages/cdk
pnpm cdk bootstrap

# 3. Deploy infrastructure
pnpm cdk:deploy --context datadogApiKey=your-key

# 4. Build and push Docker image
cd ../app
docker build -t test-datadog-crud-api:latest .
# ... push to ECR (see deployment guide)

# 5. Force ECS deployment
aws ecs update-service --cluster datadog-test-cluster-dev \
  --service test-datadog-crud-api-service-dev --force-new-deployment
```

See **[Deployment Guide](docs/deployment.md)** for complete deployment steps.

## Why pnpm Monorepo?

Benefits of this monorepo structure:

- **Shared dependencies**: Install once, use everywhere
- **Atomic changes**: Update app and infrastructure together
- **Fast**: pnpm uses hard links and content-addressable storage
- **Type safety**: Share TypeScript types between packages
- **Easy management**: Single command to build/test everything
- **Workspace protocol**: Link packages without publishing

## Cost Estimates

Running on AWS (estimated):

- **ECS Fargate**: ~$15-30/month (1 task)
- **Application Load Balancer**: ~$16/month
- **NAT Gateway**: ~$32/month
- **CloudWatch Logs**: Minimal
- **Total**: ~$60-80/month

**To minimize costs**: Run `pnpm cdk:destroy` when not in use.

## Learning Goals

This project helps you practice:

- Datadog APM and distributed tracing
- Log correlation and structured logging
- Error monitoring and alerting
- Performance profiling and optimization
- AWS ECS/Fargate deployment
- Infrastructure as Code with AWS CDK
- Monorepo management with pnpm workspaces

## Troubleshooting

Common issues and solutions are documented in the **[Troubleshooting Guide](docs/troubleshooting.md)**.

Quick fixes:

```bash
# Clean and reinstall
pnpm clean:all
pnpm install

# Check Datadog agent
docker exec datadog-agent agent status

# Enable debug logging
export DD_TRACE_DEBUG=true
pnpm dev
```

## Contributing

This is a learning and practice project. Feel free to:

- Experiment with the code
- Add new scenarios
- Create custom dashboards
- Practice incident investigation
- Extend the infrastructure

## License

MIT

---

## Quick Links

- **[Getting Started](docs/getting-started.md)** - Start here
- **[API Reference](docs/api-reference.md)** - API documentation
- **[Deployment Guide](docs/deployment.md)** - Deploy to AWS
- **[Monitoring Guide](docs/monitoring.md)** - Learn Datadog
- **[Datadog Documentation](https://docs.datadoghq.com/)** - Official Datadog docs
- **[AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)** - AWS CDK docs
