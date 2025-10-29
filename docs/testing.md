# Testing Guide

Learn how to test different scenarios and generate load to practice Datadog monitoring.

## Quick Testing

### Individual Scenario Tests

```bash
# Normal request
curl http://localhost:3000/api/products

# Client error (400)
curl http://localhost:3000/api/products?scenario=error

# Server error (500)
curl http://localhost:3000/api/products?scenario=internal-error

# Long latency (5 seconds)
time curl http://localhost:3000/api/products?scenario=long-latency

# Random latency (100ms - 3s)
curl http://localhost:3000/api/products?scenario=random-latency

# Timeout (30 seconds)
curl http://localhost:3000/api/products?scenario=timeout
```

### Test All CRUD Operations

```bash
# Get all products
curl http://localhost:3000/api/products

# Get single product
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
  -d '{
    "price": 149.99,
    "stock": 75
  }'

# Delete product
curl -X DELETE http://localhost:3000/api/products/6
```

## Load Generation

### Generate Normal Traffic

Test request throughput and latency under normal conditions:

```bash
# Generate 100 normal requests
for i in {1..100}; do
  curl -s http://localhost:3000/api/products > /dev/null &
done

# Wait for all requests to complete
wait

echo "100 requests completed"
```

### Generate Error Traffic

Test error tracking and alerting:

```bash
# Generate 50 client errors (400)
for i in {1..50}; do
  curl -s http://localhost:3000/api/products?scenario=error > /dev/null &
done

# Generate 25 server errors (500)
for i in {1..25}; do
  curl -s http://localhost:3000/api/products?scenario=internal-error > /dev/null &
done

wait
echo "Error traffic generated"
```

### Generate Latency Issues

Test latency monitoring and alerting:

```bash
# Generate random latency (100ms - 3s)
for i in {1..30}; do
  curl -s http://localhost:3000/api/products?scenario=random-latency > /dev/null &
done

# Generate long latency (5s)
for i in {1..10}; do
  curl -s http://localhost:3000/api/products?scenario=long-latency > /dev/null &
done

wait
echo "Latency traffic generated"
```

### Mixed Traffic Pattern

Simulate realistic production traffic with mixed scenarios:

```bash
#!/bin/bash

# Function to generate traffic
generate_traffic() {
  local scenario=$1
  local count=$2

  for i in $(seq 1 $count); do
    curl -s "http://localhost:3000/api/products?scenario=$scenario" > /dev/null &
  done
}

# Normal traffic (70%)
generate_traffic "normal" 70

# Random latency (20%)
generate_traffic "random-latency" 20

# Errors (8%)
generate_traffic "error" 5
generate_traffic "internal-error" 3

# Long latency (2%)
generate_traffic "long-latency" 2

wait
echo "Mixed traffic pattern completed (100 requests)"
```

## Continuous Load Testing

### Sustained Load

Generate continuous traffic for a period of time:

```bash
#!/bin/bash

# Run for 5 minutes
END=$((SECONDS+300))

while [ $SECONDS -lt $END ]; do
  # Generate batch of requests
  for i in {1..10}; do
    curl -s http://localhost:3000/api/products > /dev/null &
  done

  # Wait before next batch
  sleep 1
done

wait
echo "Sustained load test completed"
```

### Spike Testing

Simulate traffic spikes:

```bash
#!/bin/bash

echo "Generating normal traffic..."
for i in {1..20}; do
  curl -s http://localhost:3000/api/products > /dev/null &
done

sleep 5

echo "SPIKE! Generating 100 requests..."
for i in {1..100}; do
  curl -s http://localhost:3000/api/products > /dev/null &
done

sleep 10

echo "Back to normal..."
for i in {1..20}; do
  curl -s http://localhost:3000/api/products > /dev/null &
done

wait
echo "Spike test completed"
```

## Testing on AWS

If deployed to AWS ECS, replace `localhost:3000` with your ALB URL:

```bash
# Set your ALB URL
ALB_URL="http://your-alb-url.us-east-1.elb.amazonaws.com"

# Test health
curl $ALB_URL/health

# Test products
curl $ALB_URL/api/products

# Generate load
for i in {1..100}; do
  curl -s $ALB_URL/api/products > /dev/null &
done
```

## Observing Test Results in Datadog

After generating traffic, check these Datadog views:

### 1. APM - Services

**URL**: https://app.datadoghq.com/apm/services

**What to Check**:
- Request rate (requests/second)
- Latency percentiles (p50, p75, p95, p99)
- Error rate (%)
- Service map showing request flow

**Practice Tasks**:
- Compare p95 latency before and after load
- Identify which scenarios cause highest latency
- Check error rate during error traffic generation

### 2. APM - Traces

**URL**: https://app.datadoghq.com/apm/traces

**What to Check**:
- Individual request traces
- Span duration breakdown
- Error traces with stack traces
- Correlation with logs

**Practice Tasks**:
- Find the slowest trace from your test
- Examine a trace with an error
- Click through to correlated logs

### 3. Logs

**URL**: https://app.datadoghq.com/logs

**Filter**: `service:test-datadog-crud-api`

**What to Check**:
- Structured log messages
- Trace IDs in logs
- Error logs vs info logs
- Log patterns

**Practice Tasks**:
- Filter logs by severity level
- Click a trace ID to jump to APM view
- Create a log pattern for errors

### 4. Metrics

**URL**: https://app.datadoghq.com/metric/explorer

**Metrics to Check**:
- `trace.express.request`
- `trace.express.request.duration`
- `runtime.node.cpu.user`
- `runtime.node.mem.heap_used`

**Practice Tasks**:
- Graph request rate over time
- Compare CPU usage during normal vs high load
- Create percentile graphs for latency

## Testing Scenarios Reference

| Scenario | Use Case | Expected Behavior |
|----------|----------|-------------------|
| `normal` | Baseline performance | Fast response, 200 OK |
| `error` | Client error handling | Immediate 400 error |
| `internal-error` | Server error handling | Immediate 500 error |
| `long-latency` | Fixed latency | Exactly 5 second delay |
| `random-latency` | Variable performance | 100ms - 3s random delay |
| `timeout` | Timeout handling | 30 second delay |

## Practice Exercises

### Exercise 1: Baseline Performance

**Goal**: Establish baseline metrics

1. Generate 100 normal requests
2. Note the following in Datadog:
   - Average latency (p50)
   - p95 latency
   - Requests per second
   - Error rate (should be 0%)

### Exercise 2: Error Rate Monitoring

**Goal**: Practice error tracking

1. Generate 50 normal requests (baseline)
2. Generate 25 error requests
3. Generate 25 internal-error requests
4. In Datadog:
   - Calculate error rate percentage
   - View error traces
   - Check error logs

### Exercise 3: Latency Investigation

**Goal**: Identify latency issues

1. Generate mixed traffic (normal + random-latency + long-latency)
2. In Datadog APM:
   - Sort traces by duration (slowest first)
   - Compare slow vs fast traces
   - Identify latency patterns

### Exercise 4: Load Testing

**Goal**: Understand system behavior under load

1. Run sustained load for 5 minutes
2. Monitor in real-time:
   - Request rate trends
   - Latency changes over time
   - CPU and memory usage
3. Create a dashboard showing these metrics

### Exercise 5: Alerting

**Goal**: Set up proactive monitoring

1. Generate normal traffic (baseline)
2. Create monitors in Datadog:
   - Error rate > 10%
   - p95 latency > 2 seconds
   - Request rate drops to 0
3. Generate error traffic to trigger alerts
4. Verify alert notifications

## Automated Testing Script

Create a test script for consistent testing:

```bash
#!/bin/bash
# test-all-scenarios.sh

BASE_URL="${1:-http://localhost:3000}"

echo "Testing all scenarios against: $BASE_URL"
echo "==========================================="

scenarios=("normal" "error" "internal-error" "long-latency" "random-latency")

for scenario in "${scenarios[@]}"; do
  echo ""
  echo "Testing scenario: $scenario"

  response=$(curl -s -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
    "$BASE_URL/api/products?scenario=$scenario")

  echo "$response"
  echo "---"
done

echo ""
echo "All scenarios tested!"
```

Usage:
```bash
chmod +x test-all-scenarios.sh

# Local
./test-all-scenarios.sh

# AWS
./test-all-scenarios.sh http://your-alb-url.amazonaws.com
```

## Next Steps

- [Monitoring Guide](./monitoring.md) - Learn how to analyze test results in Datadog
- [API Reference](./api-reference.md) - Detailed API documentation
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
