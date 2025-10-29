# Commands Reference

Quick reference for common commands used in the Datadog Observability Playground.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start with Docker Compose
cd packages/app && export DD_API_KEY=your-key && docker-compose up

# Start with pnpm (from root)
pnpm dev
```

## pnpm Workspace Commands

### From Repository Root

```bash
# Application
pnpm dev                    # Run app in development mode
pnpm build                  # Build application
pnpm start                  # Start production build
pnpm build:all              # Build all packages

# Infrastructure (CDK)
pnpm cdk:deploy             # Deploy to AWS
pnpm cdk:destroy            # Destroy AWS resources
pnpm cdk:synth              # Synthesize CloudFormation
pnpm cdk:diff               # Show infrastructure changes

# Maintenance
pnpm clean                  # Clean build outputs
pnpm clean:all              # Clean everything including node_modules
```

### Package-Specific Commands

```bash
# Application package
pnpm --filter app dev
pnpm --filter app build
pnpm --filter app start

# CDK package
pnpm --filter cdk deploy
pnpm --filter cdk destroy
```

### From packages/app

```bash
pnpm dev                    # Development with nodemon
pnpm dev:docker             # Development for Docker
pnpm build                  # Compile TypeScript
pnpm start                  # Run compiled code
pnpm start:local            # Run with ts-node
```

### From packages/cdk

```bash
pnpm synth                  # Synthesize CloudFormation
pnpm diff                   # Show differences
pnpm deploy                 # Deploy stack
pnpm destroy                # Destroy stack
```

## Docker Commands

### Docker Compose

```bash
# Start everything
docker-compose -f packages/app/docker-compose.yml up

# Start in background
docker-compose -f packages/app/docker-compose.yml up -d

# View logs
docker-compose -f packages/app/docker-compose.yml logs -f
docker-compose -f packages/app/docker-compose.yml logs -f app
docker-compose -f packages/app/docker-compose.yml logs -f datadog-agent

# Stop everything
docker-compose -f packages/app/docker-compose.yml down

# Stop and remove volumes
docker-compose -f packages/app/docker-compose.yml down -v

# Restart service
docker-compose -f packages/app/docker-compose.yml restart app
```

### Standalone Datadog Agent

```bash
# Start agent
docker run -d --name datadog-agent \
  -e DD_API_KEY=your-key \
  -e DD_SITE=datadoghq.com \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -p 8126:8126 -p 8125:8125/udp \
  gcr.io/datadoghq/agent:latest

# Check status
docker exec datadog-agent agent status

# View logs
docker logs datadog-agent
docker logs -f datadog-agent

# Stop agent
docker stop datadog-agent
docker rm datadog-agent
```

### Docker Image Management

```bash
# Build application image
cd packages/app
docker build -t test-datadog-crud-api:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e DD_AGENT_HOST=host.docker.internal \
  -e DD_API_KEY=your-key \
  test-datadog-crud-api:latest

# List images
docker images

# Remove image
docker rmi test-datadog-crud-api:latest

# Clean up
docker system prune -a
```

## API Testing Commands

### Basic Requests

```bash
# Health check
curl http://localhost:3000/health

# Get all products
curl http://localhost:3000/api/products

# Get product by ID
curl http://localhost:3000/api/products/1

# Create product
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "price": 99.99,
    "category": "Test",
    "stock": 100
  }'

# Update product
curl -X PUT http://localhost:3000/api/products/1 \
  -H "Content-Type: application/json" \
  -d '{"price": 149.99}'

# Delete product
curl -X DELETE http://localhost:3000/api/products/1
```

### Scenario Testing

```bash
# Normal request
curl http://localhost:3000/api/products

# Client error (400)
curl http://localhost:3000/api/products?scenario=error

# Server error (500)
curl http://localhost:3000/api/products?scenario=internal-error

# Long latency (5 seconds)
curl http://localhost:3000/api/products?scenario=long-latency

# Random latency (100ms - 3s)
curl http://localhost:3000/api/products?scenario=random-latency

# Timeout (30 seconds)
curl http://localhost:3000/api/products?scenario=timeout
```

### Load Generation

```bash
# Generate 100 normal requests
for i in {1..100}; do curl -s http://localhost:3000/api/products > /dev/null & done

# Generate error traffic
for i in {1..50}; do curl -s http://localhost:3000/api/products?scenario=error > /dev/null & done

# Generate latency traffic
for i in {1..20}; do curl -s http://localhost:3000/api/products?scenario=random-latency > /dev/null & done

# Wait for completion
wait
```

## AWS CLI Commands

### ECR

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <ECR_URI>

# List repositories
aws ecr describe-repositories --region us-east-1

# List images
aws ecr list-images \
  --repository-name test-datadog-crud-api \
  --region us-east-1

# Delete image
aws ecr batch-delete-image \
  --repository-name test-datadog-crud-api \
  --image-ids imageTag=latest \
  --region us-east-1
```

### ECS

```bash
# List clusters
aws ecs list-clusters --region us-east-1

# Describe service
aws ecs describe-services \
  --cluster datadog-test-cluster-dev \
  --services test-datadog-crud-api-service-dev \
  --region us-east-1

# List tasks
aws ecs list-tasks \
  --cluster datadog-test-cluster-dev \
  --service-name test-datadog-crud-api-service-dev \
  --region us-east-1

# Describe task
aws ecs describe-tasks \
  --cluster datadog-test-cluster-dev \
  --tasks <task-id> \
  --region us-east-1

# Force new deployment
aws ecs update-service \
  --cluster datadog-test-cluster-dev \
  --service test-datadog-crud-api-service-dev \
  --force-new-deployment \
  --region us-east-1

# Stop task
aws ecs stop-task \
  --cluster datadog-test-cluster-dev \
  --task <task-id> \
  --region us-east-1
```

### CloudWatch Logs

```bash
# Tail application logs
aws logs tail /ecs/test-datadog-crud-api-dev --follow

# Tail agent logs
aws logs tail /ecs/datadog-agent-dev --follow

# Get log events
aws logs get-log-events \
  --log-group-name /ecs/test-datadog-crud-api-dev \
  --log-stream-name <stream-name> \
  --region us-east-1
```

### CloudFormation

```bash
# List stacks
aws cloudformation list-stacks --region us-east-1

# Describe stack
aws cloudformation describe-stacks \
  --stack-name DatadogAppStack-dev \
  --region us-east-1

# Get stack outputs
aws cloudformation describe-stacks \
  --stack-name DatadogAppStack-dev \
  --query 'Stacks[0].Outputs' \
  --region us-east-1

# Delete stack
aws cloudformation delete-stack \
  --stack-name DatadogAppStack-dev \
  --region us-east-1
```

### Secrets Manager

```bash
# Create secret
aws secretsmanager create-secret \
  --name datadog-api-key-dev \
  --secret-string "your-api-key" \
  --region us-east-1

# Get secret value
aws secretsmanager get-secret-value \
  --secret-id datadog-api-key-dev \
  --region us-east-1

# Update secret
aws secretsmanager update-secret \
  --secret-id datadog-api-key-dev \
  --secret-string "new-api-key" \
  --region us-east-1

# Delete secret
aws secretsmanager delete-secret \
  --secret-id datadog-api-key-dev \
  --force-delete-without-recovery \
  --region us-east-1
```

## CDK Commands

```bash
# Bootstrap (first time only)
pnpm cdk bootstrap

# Synthesize CloudFormation template
pnpm cdk:synth

# Show differences
pnpm cdk:diff

# Deploy stack
pnpm cdk:deploy

# Deploy with context
pnpm cdk:deploy --context datadogApiKey=your-key
pnpm cdk:deploy --context environment=staging

# Destroy stack
pnpm cdk:destroy

# List stacks
pnpm cdk list
```

## Troubleshooting Commands

### Check Versions

```bash
node --version                # Node.js version
pnpm --version                # pnpm version
docker --version              # Docker version
aws --version                 # AWS CLI version
```

### Check Ports

```bash
# Check if port is in use
lsof -i :3000
lsof -i :8126

# Test port connectivity
nc -zv localhost 3000
nc -zv localhost 8126
telnet localhost 8126
```

### Process Management

```bash
# Find process by port
lsof -i :3000

# Kill process
kill -9 <PID>

# Kill all node processes
pkill -9 node
```

### Clean Up

```bash
# Clean build outputs
pnpm clean

# Clean everything
pnpm clean:all

# Clean Docker
docker system prune -a
docker volume prune

# Clean pnpm cache
pnpm store prune
```

### Debug Logging

```bash
# Enable Datadog tracer debug
export DD_TRACE_DEBUG=true
pnpm dev

# Check environment variables
env | grep DD_
echo $DD_API_KEY
echo $DD_AGENT_HOST

# Node.js debug
node -e "console.log(process.env.DD_AGENT_HOST)"
```

## Datadog URLs

```bash
# Main dashboards
open https://app.datadoghq.com/apm/services
open https://app.datadoghq.com/apm/traces
open https://app.datadoghq.com/logs
open https://app.datadoghq.com/infrastructure
open https://app.datadoghq.com/metric/explorer
open https://app.datadoghq.com/dashboard/lists
open https://app.datadoghq.com/monitors/manage

# Filter by service
# Add: service:test-datadog-crud-api
```

## Environment Variables

### Required

```bash
# Datadog API key
export DD_API_KEY=your-datadog-api-key

# For EU Datadog accounts
export DD_SITE=datadoghq.eu

# For US accounts (default)
export DD_SITE=datadoghq.com
```

### Optional

```bash
# Application
export PORT=3000
export NODE_ENV=development

# Datadog configuration
export DD_SERVICE=test-datadog-crud-api
export DD_ENV=local
export DD_VERSION=1.0.0
export DD_AGENT_HOST=localhost
export DD_TRACE_AGENT_PORT=8126
export DD_LOGS_INJECTION=true
export DD_RUNTIME_METRICS_ENABLED=true
export DD_PROFILING_ENABLED=true

# Debug
export DD_TRACE_DEBUG=true
export LOG_LEVEL=debug
```

## Useful Aliases

Add to your `.bashrc` or `.zshrc`:

```bash
# Alias for common commands
alias ddapi='cd ~/path/to/datadog-observability-playground'
alias ddstart='cd ~/path/to/datadog-observability-playground && pnpm dev'
alias ddtest='curl http://localhost:3000/api/products'
alias ddlogs='docker-compose -f packages/app/docker-compose.yml logs -f'
alias ddstatus='docker exec datadog-agent agent status'

# AWS helpers
alias ecs-logs='aws logs tail /ecs/test-datadog-crud-api-dev --follow'
alias ecs-deploy='aws ecs update-service --cluster datadog-test-cluster-dev --service test-datadog-crud-api-service-dev --force-new-deployment'
```

## Related Documentation

- [Getting Started](./getting-started.md) - Initial setup
- [Local Development](./local-development.md) - Development workflows
- [API Reference](./api-reference.md) - API endpoints
- [Testing Guide](./testing.md) - Testing scenarios
- [Deployment Guide](./deployment.md) - AWS deployment
- [Troubleshooting](./troubleshooting.md) - Common issues
