# Architecture Overview

System architecture and design of the Datadog Observability Playground.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Datadog Cloud Platform                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   APM    │  │   Logs   │  │ Metrics  │  │  Infra   │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │ Trace, Logs, Metrics
                       │
┌──────────────────────┴──────────────────────────────────────┐
│              Datadog Agent (Port 8126/8125)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴─────────────────────────────────────┐
│         Node.js Application (Port 3000)                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  dd-trace (APM Tracer)                             │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Express.js REST API                               │    │
│  │  - Product CRUD Routes                             │    │
│  │  - Scenario Simulator                              │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Pino Logger (with DD trace injection)             │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

## Application Architecture

### Tech Stack

**Runtime**:
- Node.js 18+
- TypeScript 5.x

**Web Framework**:
- Express.js 4.x

**Observability**:
- dd-trace (Datadog APM client)
- Pino (JSON structured logging)
- Datadog Agent

**Infrastructure as Code**:
- AWS CDK (TypeScript)

**Package Management**:
- pnpm workspaces (monorepo)

### Project Structure

```
datadog-observability-playground/
├── packages/
│   ├── app/                           # Application package
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point (loads tracer first!)
│   │   │   ├── tracer.ts             # Datadog tracer initialization
│   │   │   ├── logger.ts             # Pino logger configuration
│   │   │   ├── app.ts                # Express app setup
│   │   │   ├── server.ts             # HTTP server
│   │   │   ├── data.ts               # In-memory product data
│   │   │   ├── routes/
│   │   │   │   └── products.ts       # Product CRUD routes
│   │   │   └── utils/
│   │   │       └── scenarioSimulator.ts  # Scenario middleware
│   │   ├── Dockerfile                # Multi-stage Docker build
│   │   ├── docker-compose.yml        # Local dev environment
│   │   └── package.json              # App dependencies
│   │
│   └── cdk/                          # Infrastructure package
│       ├── bin/
│       │   └── app.ts                # CDK app entry point
│       ├── lib/
│       │   └── datadog-app-stack.ts  # Main stack definition
│       └── package.json              # CDK dependencies
│
├── docs/                             # Consolidated documentation
├── package.json                      # Root package.json (workspace scripts)
└── pnpm-workspace.yaml               # Workspace configuration
```

## Component Details

### 1. Tracer Initialization (`tracer.ts`)

**Purpose**: Initialize Datadog APM tracer

**Key Configuration**:
```typescript
- service: 'test-datadog-crud-api'
- env: 'local' | 'dev' | 'staging' | 'prod'
- version: Application version
- logInjection: true (adds trace IDs to logs)
- runtimeMetrics: true (Node.js metrics)
- profiling: true (CPU/memory profiling)
```

**Critical**: Must be loaded **BEFORE** any other modules.

### 2. Logger (`logger.ts`)

**Purpose**: Structured JSON logging with trace correlation

**Features**:
- JSON format for parsing
- Trace ID injection
- Automatic log levels
- Request/response logging

**Log Structure**:
```json
{
  "level": "info",
  "time": 1234567890,
  "msg": "Request received",
  "dd.trace_id": "123456",
  "dd.span_id": "789012",
  "http.method": "GET",
  "http.url": "/api/products"
}
```

### 3. Express Application (`app.ts`)

**Middleware Stack** (in order):
1. `express.json()` - Parse JSON bodies
2. Request logging middleware
3. Scenario simulator middleware
4. Route handlers
5. Error handling middleware

**Routes**:
- `GET /health` - Health check
- `GET /api/products` - List products
- `GET /api/products/:id` - Get product
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### 4. Scenario Simulator (`scenarioSimulator.ts`)

**Purpose**: Simulate different application states for testing

**Middleware Flow**:
```
Request → Check ?scenario=<type> → Apply delay/error → Next/Error
```

**Scenarios**:
- `normal`: No modification
- `error`: Throw 400 error
- `internal-error`: Throw 500 error
- `long-latency`: 5 second delay
- `random-latency`: 100ms-3s random delay
- `timeout`: 30 second delay

### 5. Data Layer (`data.ts`)

**Storage**: In-memory JavaScript array

**Structure**:
```typescript
interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  stock: number;
}
```

**Operations**:
- `getAllProducts()`
- `getProductById(id)`
- `createProduct(product)`
- `updateProduct(id, updates)`
- `deleteProduct(id)`

**Note**: Data resets on application restart.

## AWS Architecture

### Local Development

```
┌──────────────────────────────────────┐
│  Developer Laptop                     │
│                                       │
│  ┌────────────────────────────┐      │
│  │  Node.js App (pnpm dev)    │      │
│  │  Port 3000                 │      │
│  └────────────┬───────────────┘      │
│               │                       │
│  ┌────────────┴───────────────┐      │
│  │  Datadog Agent (Docker)    │      │
│  │  Ports 8126/8125           │      │
│  └────────────┬───────────────┘      │
└───────────────┼───────────────────────┘
                │
                │ Internet
                ↓
   ┌────────────────────────┐
   │  Datadog Cloud         │
   └────────────────────────┘
```

### AWS ECS Deployment

```
                         Internet
                            │
                            ↓
          ┌─────────────────────────────────────┐
          │  Application Load Balancer (ALB)    │
          │  Port 80                            │
          └─────────────┬───────────────────────┘
                        │
                ┌───────┴────────┐
                │  Target Group  │
                │  Port 3000     │
                └───────┬────────┘
                        │
          ┌─────────────┴─────────────────────────-┐
          │          ECS Fargate Service           │
          │                                        │
          │  ┌──────────────────────────────────┐  │
          │  │  Task Definition                 │  │
          │  │                                  │  │
          │  │  ┌────────────────────────────┐  │  │
          │  │  │  App Container             │  │  │
          │  │  │  - Node.js app             │  │  │
          │  │  │  - Port 3000               │  │  │
          │  │  │  - ECR image               │  │  │
          │  │  └────────────────────────────┘  │  │
          │  │                                  │  │
          │  │  ┌────────────────────────────┐  │  │
          │  │  │  Datadog Agent Sidecar     │  │  │
          │  │  │  - Port 8126 (APM)         │  │  │
          │  │  │  - Port 8125 (StatsD)      │  │  │
          │  │  │  - API key from Secrets    │  │  │
          │  │  └────────────────────────────┘  │  │
          │  └──────────────────────────────────┘  │
          └────────────────────────────────────────┘
                        │
                        │ Logs
                        ↓
          ┌─────────────────────────┐
          │  CloudWatch Log Groups  │
          │  - /ecs/app-dev         │
          │  - /ecs/agent-dev       │
          └─────────────────────────┘
```

### AWS Infrastructure Components

**Networking**:
- VPC with public and private subnets across 2 AZs
- Internet Gateway for public subnet
- NAT Gateway for private subnet egress
- Route tables for subnet routing

**Compute**:
- ECS Fargate cluster
- ECS service with desired count = 1
- Task definition (app + agent containers)
- Auto-scaling: 1-4 tasks based on CPU/memory

**Load Balancing**:
- Application Load Balancer (internet-facing)
- Target group (port 3000)
- Health check: `/health` endpoint
- Security group: Allow HTTP from internet

**Storage**:
- ECR repository for Docker images
- CloudWatch log groups (7-day retention)

**Security**:
- Secrets Manager for Datadog API key
- IAM roles for ECS task execution
- Security groups for ALB and ECS

## Data Flow

### Request Flow

```
1. Client Request
   ↓
2. Load Balancer (if AWS) / Localhost
   ↓
3. Express.js receives request
   ↓
4. dd-trace creates span (root span)
   ↓
5. Logger logs request (with trace ID)
   ↓
6. Scenario Simulator middleware
   ↓
7. Route handler executes
   ↓
8. Data layer operation (if needed)
   ↓
9. Route handler returns response
   ↓
10. Logger logs response (with trace ID)
    ↓
11. dd-trace closes span
    ↓
12. Response sent to client
    ↓
13. Span sent to Datadog Agent
    ↓
14. Agent forwards to Datadog Cloud
```

### Telemetry Flow

**Traces**:
```
App (dd-trace) → Agent (port 8126) → Datadog APM
```

**Logs**:
```
App (Pino) → stdout → Agent → Datadog Logs
```

**Metrics**:
```
App (dd-trace runtime) → Agent (port 8125) → Datadog Metrics
```

**Infrastructure**:
```
Agent → System metrics → Datadog Infrastructure
```

## Observability Strategy

### What's Instrumented

**HTTP Requests**:
- All Express routes automatically traced
- Request/response logged
- Status codes, URLs, methods captured

**Performance**:
- Request duration (p50, p75, p95, p99)
- Endpoint-level latency
- Error rates

**Runtime**:
- Node.js heap memory
- CPU usage
- Event loop delay
- Garbage collection

**Custom**:
- Product operations (CRUD)
- Scenario simulations
- Business logic

### Trace Structure

```
Root Span: express.request
├── Span: route.handler
│   └── Span: data.operation
└── Span: response.send
```

**Span Tags**:
- `http.method`
- `http.url`
- `http.status_code`
- `resource.name`
- `service.name`
- `env`

### Log Correlation

Every log includes:
- `dd.trace_id` - Links to trace
- `dd.span_id` - Links to specific span
- Request context (method, URL, etc.)

This enables:
- Jump from log to trace
- Jump from trace to logs
- Full request context

## Scalability Considerations

### Horizontal Scaling (AWS)

- Auto-scaling: 1-4 tasks based on CPU/memory
- Load balanced across tasks
- Stateless design (no session state)

**Limitations**:
- In-memory data store (not shared across tasks)
- Each task has independent product data

**For Production**:
- Add database (RDS, DynamoDB)
- Add caching (ElastiCache)
- Add session store (Redis)

### Vertical Scaling

**Local**:
- Limited by laptop resources

**AWS**:
- Increase task CPU/memory
- Available sizes: 0.25-4 vCPU, 0.5-30 GB RAM

## Security Architecture

### Secrets Management

**Local**:
- Environment variables
- `.env` file (gitignored)

**AWS**:
- Secrets Manager for Datadog API key
- IAM roles for access
- No secrets in task definition

### Network Security

**Local**:
- Localhost only (not exposed to internet)

**AWS**:
- ALB in public subnet (internet-facing)
- ECS tasks in private subnet
- Security groups restrict access
- No direct internet access to tasks

### Container Security

- Multi-stage Docker build
- Minimal base image (node:18-alpine)
- Non-root user in container
- Read-only root filesystem (where possible)

## Monitoring Architecture

### Metrics Hierarchy

```
Infrastructure (Host/Container)
└── Runtime (Node.js)
    └── Application (Express)
        └── Business Logic (Products)
```

### Dashboard Organization

1. **Infrastructure**: CPU, memory, network, disk
2. **Runtime**: Node.js specific metrics
3. **Application**: Requests, latency, errors
4. **Business**: Product operations, scenarios

## Deployment Architecture

### CI/CD Flow (Recommended)

```
Code Push → Build → Test → Build Docker → Push ECR → Deploy ECS
```

### Blue-Green Deployment

With ECS:
1. Deploy new task definition
2. ECS starts new tasks
3. Health checks pass
4. Old tasks drained
5. Old tasks terminated

### Rollback

With ECS:
1. Deploy previous task definition
2. Automatic rollout

## Cost Architecture

### Cost Drivers

**AWS**:
- ECS Fargate tasks (CPU/memory/hour)
- Application Load Balancer (hours + LCUs)
- NAT Gateway (hours + data transfer)
- CloudWatch Logs (ingestion + storage)
- Data transfer out

**Datadog**:
- Free tier: 5 hosts, 15-day retention
- Paid: Per-host pricing, additional retention

### Cost Optimization

- Use `dev` environment for learning
- Destroy when not in use
- Use VPC endpoints (avoid NAT costs)
- Adjust log retention
- Use Fargate Spot (for non-production)

## Next Steps

- [Getting Started](./getting-started.md) - Set up the application
- [Local Development](./local-development.md) - Development workflows
- [Deployment Guide](./deployment.md) - Deploy to AWS
- [Monitoring Guide](./monitoring.md) - Observe the system
