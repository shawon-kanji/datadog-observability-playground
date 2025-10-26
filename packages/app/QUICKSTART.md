# Quick Start Guide

Get up and running with the Datadog CRUD API in minutes!

## Option 1: Quick Local Test (No Datadog Agent)

This runs the app locally without a Datadog agent. Traces and metrics won't be sent, but you can test the API.

```bash
# Install dependencies
npm install

# Start the server
npm run dev
```

Visit: http://localhost:3000/api/products

## Option 2: Local with Datadog (Recommended for Testing)

Run with Docker Compose to include the Datadog agent.

```bash
# Set your Datadog API key
export DD_API_KEY=your-datadog-api-key

# Start everything
docker-compose up

# Test the API
curl http://localhost:3000/api/products

# Run scenario tests
./test-scenarios.sh
```

View your data in Datadog:
- APM: https://app.datadoghq.com/apm/services
- Logs: https://app.datadoghq.com/logs

## Option 3: Deploy to AWS ECS

### Prerequisites Setup (One-time)

```bash
# Set variables
export AWS_REGION=us-east-1
export DD_API_KEY=your-datadog-api-key

# 1. Create ECR repository
aws ecr create-repository \
  --repository-name test-datadog-crud-api \
  --region $AWS_REGION

# 2. Store Datadog API key
aws secretsmanager create-secret \
  --name datadog-api-key \
  --secret-string "$DD_API_KEY" \
  --region $AWS_REGION

# 3. Create log groups
aws logs create-log-group --log-group-name /ecs/test-datadog-crud-api --region $AWS_REGION
aws logs create-log-group --log-group-name /ecs/datadog-agent --region $AWS_REGION

# 4. Create ECS cluster
aws ecs create-cluster --cluster-name datadog-test-cluster --region $AWS_REGION

# 5. Create VPC resources (if needed)
# Use existing VPC or create new one with subnets and security groups

# 6. Update ecs-task-definition.json
# Replace YOUR_ACCOUNT_ID and YOUR_ECR_REPO_URI with your values

# 7. Create ECS service
aws ecs create-service \
  --cluster datadog-test-cluster \
  --service-name test-datadog-crud-api-service \
  --task-definition test-datadog-crud-api \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --region $AWS_REGION
```

### Deploy

```bash
# Deploy to ECS
./deploy-ecs.sh

# Get service URL (if using ALB)
aws elbv2 describe-load-balancers --region $AWS_REGION

# Test the deployed API
curl http://your-alb-url/api/products
./test-scenarios.sh http://your-alb-url
```

## Testing Scenarios

### Test Individual Scenarios

```bash
# Normal request
curl http://localhost:3000/api/products

# Error (400)
curl http://localhost:3000/api/products?scenario=error

# Internal Error (500)
curl http://localhost:3000/api/products?scenario=internal-error

# Long latency (5s)
time curl http://localhost:3000/api/products?scenario=long-latency

# Random latency
curl http://localhost:3000/api/products?scenario=random-latency
```

### Run All Tests

```bash
./test-scenarios.sh
```

### Generate Load

```bash
# Normal traffic
for i in {1..100}; do curl http://localhost:3000/api/products & done

# Error traffic
for i in {1..50}; do curl http://localhost:3000/api/products?scenario=error & done

# Mixed latency
for i in {1..20}; do
  curl http://localhost:3000/api/products?scenario=random-latency &
done
```

## What to Check in Datadog

After running tests, explore these Datadog features:

### 1. APM (https://app.datadoghq.com/apm/services)
- Find service: `test-datadog-crud-api`
- View request rate, latency, errors
- Click on traces to see distributed tracing
- Explore service map

### 2. Logs (https://app.datadoghq.com/logs)
- Filter: `service:test-datadog-crud-api`
- Notice trace IDs in logs
- Click trace ID to jump to APM view

### 3. Infrastructure (https://app.datadoghq.com/infrastructure)
- View runtime metrics (CPU, memory)
- See container/ECS task metrics

### 4. Dashboards (https://app.datadoghq.com/dashboard/lists)
- Create custom dashboard
- Add widgets for:
  - Request rate
  - Error rate
  - Latency percentiles (p50, p95, p99)
  - Custom metrics

### 5. Monitors (https://app.datadoghq.com/monitors)
Create alerts for:
- Error rate > threshold
- p99 latency > 5 seconds
- Service availability

## CRUD Operations Examples

### Get All Products
```bash
curl http://localhost:3000/api/products
```

### Get Product by ID
```bash
curl http://localhost:3000/api/products/1
```

### Create Product
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Laptop",
    "price": 1299.99,
    "category": "Electronics",
    "stock": 25
  }'
```

### Update Product
```bash
curl -X PUT http://localhost:3000/api/products/1 \
  -H "Content-Type: application/json" \
  -d '{
    "price": 899.99,
    "stock": 40
  }'
```

### Delete Product
```bash
curl -X DELETE http://localhost:3000/api/products/1
```

## Troubleshooting

### Port already in use
```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

### Datadog not receiving data
```bash
# Check agent status (Docker Compose)
docker-compose exec datadog-agent agent status

# Check agent logs
docker-compose logs datadog-agent

# Verify API key
echo $DD_API_KEY
```

### Build errors
```bash
# Clean install
rm -rf node_modules dist
npm install
npm run build
```

## Next Steps

1. Run the app locally and test endpoints
2. Generate different scenarios
3. Explore Datadog dashboards
4. Create custom monitors
5. Set up alerts
6. Deploy to ECS
7. Practice incident investigation

## Learning Resources

- [Datadog APM Docs](https://docs.datadoghq.com/tracing/)
- [Datadog Logging](https://docs.datadoghq.com/logs/)
- [AWS ECS with Datadog](https://docs.datadoghq.com/integrations/ecs_fargate/)

Happy monitoring!
