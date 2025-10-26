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

## Project Structure

```
.
├── src/
│   ├── app.ts                      # Express app configuration
│   ├── server.ts                   # Server entry point
│   ├── tracer.ts                   # Datadog tracer initialization
│   ├── logger.ts                   # Custom logger with DD integration
│   ├── data.ts                     # Static product data
│   ├── routes/
│   │   └── products.ts             # Product CRUD routes
│   └── utils/
│       └── scenarioSimulator.ts    # Scenario simulation middleware
├── Dockerfile                      # Multi-stage Docker build
├── docker-compose.yml              # Local development with Datadog agent
├── ecs-task-definition.json        # ECS Fargate task definition
├── deploy-ecs.sh                   # ECS deployment script
└── package.json
```

## Quick Start

### Automated Setup (Recommended)

```bash
# Run the setup script and choose your option
./setup-local.sh
```

The script will guide you through:
1. **Docker Compose** - Easiest, runs everything in containers
2. **Dockerized Agent + Local App** - Agent in Docker, app runs natively
3. **Manual Setup** - Install dependencies only

### Manual Quick Start

See detailed instructions in [LOCAL_SETUP.md](LOCAL_SETUP.md) for all options.

**Option 1: Docker Compose (Easiest)**
```bash
export DD_API_KEY=your-datadog-api-key
docker-compose up
```

**Option 2: Local Node.js + Dockerized Agent**
```bash
# Start Datadog agent in Docker
docker run -d --name datadog-agent \
  -e DD_API_KEY=your-key \
  -e DD_SITE=datadoghq.com \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -p 8126:8126 -p 8125:8125/udp \
  gcr.io/datadoghq/agent:latest

# Run your app locally
npm install
npm run dev
```

**Option 3: Native Datadog Agent on Laptop**

Install the agent directly on your machine:
- macOS: `DD_API_KEY=your-key bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_mac_os.sh)"`
- Linux: See [LOCAL_SETUP.md](LOCAL_SETUP.md)
- Windows: Download from [Datadog](https://www.datadoghq.com/)

Then run: `npm install && npm run dev`

## Prerequisites

- Node.js 18+ (for local development)
- Docker (for containerized setup)
- Datadog account and API key (get one at https://app.datadoghq.com/)
- (For ECS) AWS account with ECR and ECS configured

## Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# Application
PORT=3000
NODE_ENV=production

# Datadog
DD_SERVICE=test-datadog-crud-api
DD_ENV=production
DD_VERSION=1.0.0
DD_AGENT_HOST=localhost  # or datadog-agent for Docker
DD_TRACE_AGENT_PORT=8126
DD_API_KEY=your-datadog-api-key
```

## Local Development

### Option 1: Node.js

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

### Option 2: Docker Compose (with Datadog Agent)

```bash
# Set your Datadog API key
export DD_API_KEY=your-datadog-api-key

# Start application and Datadog agent
docker-compose up

# Stop and remove containers
docker-compose down
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

# With scenario
POST /api/products?scenario=error
```

#### Update Product
```bash
PUT /api/products/:id
Content-Type: application/json

{
  "name": "Updated Product",
  "price": 149.99
}

# With scenario
PUT /api/products/1?scenario=internal-error
```

#### Delete Product
```bash
DELETE /api/products/:id
DELETE /api/products/1?scenario=timeout
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

## Testing Scenarios with cURL

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

# Create product with error
curl -X POST http://localhost:3000/api/products?scenario=error \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","price":99,"category":"Test","stock":10}'
```

## AWS ECS Deployment

### Prerequisites

1. **Create ECR Repository**
```bash
aws ecr create-repository \
  --repository-name test-datadog-crud-api \
  --region us-east-1
```

2. **Store Datadog API Key in Secrets Manager**
```bash
aws secretsmanager create-secret \
  --name datadog-api-key \
  --secret-string "your-datadog-api-key" \
  --region us-east-1
```

3. **Create CloudWatch Log Groups**
```bash
aws logs create-log-group \
  --log-group-name /ecs/test-datadog-crud-api \
  --region us-east-1

aws logs create-log-group \
  --log-group-name /ecs/datadog-agent \
  --region us-east-1
```

4. **Create ECS Cluster**
```bash
aws ecs create-cluster \
  --cluster-name datadog-test-cluster \
  --region us-east-1
```

5. **Create ECS Service**
```bash
aws ecs create-service \
  --cluster datadog-test-cluster \
  --service-name test-datadog-crud-api-service \
  --task-definition test-datadog-crud-api \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --region us-east-1
```

### Deploy

```bash
# Run deployment script
./deploy-ecs.sh

# Monitor deployment
aws ecs describe-services \
  --cluster datadog-test-cluster \
  --services test-datadog-crud-api-service \
  --region us-east-1
```

## Datadog Dashboard Exploration

Once deployed, you can explore various Datadog features:

### APM & Tracing
1. Navigate to **APM > Services** in Datadog
2. Find `test-datadog-crud-api` service
3. Explore:
   - Service overview metrics
   - Trace analytics
   - Service map
   - Resource statistics

### Logs
1. Navigate to **Logs** in Datadog
2. Filter by: `service:test-datadog-crud-api`
3. Notice trace correlation (trace IDs in logs)
4. Use different scenario queries to see error patterns

### Metrics & Monitoring
1. **Infrastructure > Metrics Explorer**
   - Runtime metrics (memory, CPU)
   - Custom metrics
2. **APM > Service Page**
   - Latency percentiles (p50, p75, p95, p99)
   - Error rates
   - Throughput

### Creating Monitors

Create monitors for:
- High error rate: `error.rate{service:test-datadog-crud-api}`
- High latency: `trace.express.request{service:test-datadog-crud-api}`
- Service availability

### Practice Scenarios

1. **Generate Normal Traffic**
   ```bash
   for i in {1..100}; do curl http://your-service/api/products; done
   ```

2. **Generate Errors**
   ```bash
   for i in {1..50}; do curl http://your-service/api/products?scenario=error; done
   ```

3. **Generate Latency Issues**
   ```bash
   for i in {1..20}; do curl http://your-service/api/products?scenario=long-latency & done
   ```

4. **Monitor and Alert**
   - Watch metrics spike in Datadog
   - See traces appear with different durations
   - Correlate logs with traces
   - Set up alerts for anomalies

## Performance Profiling

The application includes continuous profiling. View profiling data in:
- Datadog > APM > Profiling
- Analyze CPU, memory allocation, and I/O

## Troubleshooting

### Datadog Agent Not Receiving Data

**Local (Docker Compose)**
```bash
# Check agent status
docker-compose exec datadog-agent agent status
```

**ECS**
```bash
# Check container logs
aws logs tail /ecs/datadog-agent --follow
```

### No Traces Appearing

1. Verify tracer initialization happens first (check `src/server.ts`)
2. Check environment variables are set correctly
3. Verify agent is reachable: `DD_AGENT_HOST` and `DD_TRACE_AGENT_PORT`

### Build Errors

```bash
# Clean and reinstall
rm -rf node_modules dist
npm install
npm run build
```

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!
