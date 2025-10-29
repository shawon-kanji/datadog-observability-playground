# Monitoring with Datadog

Comprehensive guide to monitoring your application with Datadog APM, logging, and metrics.

## Accessing Datadog

Main Datadog dashboards:
- **APM Services**: https://app.datadoghq.com/apm/services
- **Traces**: https://app.datadoghq.com/apm/traces
- **Logs**: https://app.datadoghq.com/logs
- **Infrastructure**: https://app.datadoghq.com/infrastructure
- **Metrics Explorer**: https://app.datadoghq.com/metric/explorer
- **Dashboards**: https://app.datadoghq.com/dashboard/lists
- **Monitors**: https://app.datadoghq.com/monitors/manage

## Filter by Service

In all views, filter by your service:
```
service:test-datadog-crud-api
```

For environment-specific filtering:
```
service:test-datadog-crud-api env:local
service:test-datadog-crud-api env:dev
```

## 1. Application Performance Monitoring (APM)

### Viewing Your Service

1. Go to **APM → Services**
2. Find `test-datadog-crud-api` in the services list
3. Click to view detailed metrics

### Key Metrics

**Request Rate**:
- Requests per second
- Trend over time
- Compare across time periods

**Latency**:
- p50 (median): 50% of requests faster than this
- p75: 75% of requests faster than this
- p95: 95% of requests faster than this
- p99: 99% of requests faster than this
- Max: Slowest request

**Error Rate**:
- Percentage of failed requests
- Error count
- Error types

### Service Map

**Access**: APM → Service Map

Shows visual representation of:
- Service dependencies
- Request flow
- Latency between services
- Error rates

### Resources

**Access**: APM → Services → test-datadog-crud-api → Resources

View performance by:
- Endpoints (`GET /api/products`, `POST /api/products`, etc.)
- HTTP methods
- Database queries (if applicable)

**Practice**:
1. Identify which endpoint is slowest
2. Compare latency across different endpoints
3. Find endpoints with highest error rates

## 2. Distributed Tracing

### Viewing Traces

**Access**: APM → Traces

**Filter examples**:
```
service:test-datadog-crud-api
service:test-datadog-crud-api status:error
service:test-datadog-crud-api @http.status_code:500
```

### Trace Details

Click any trace to see:
- **Flame Graph**: Visual span timeline
- **Span List**: All operations in the request
- **Host Info**: Container/server details
- **Logs**: Correlated log entries
- **Infrastructure**: System metrics during request

### Span Information

Each span shows:
- Operation name
- Duration
- Tags and metadata
- Error details (if any)

### Correlating Traces and Logs

1. Click on a trace
2. Scroll to "Logs" tab
3. See all logs from that request
4. Click "View in Log Explorer"

**Reverse correlation**:
1. Go to Logs
2. Find a log with a trace ID
3. Click the trace ID to view the full trace

## 3. Logging

### Log Explorer

**Access**: Logs → Log Explorer

**Filter**: `service:test-datadog-crud-api`

### Log Structure

Logs are JSON-formatted with:
```json
{
  "timestamp": "2025-10-29T10:30:00.000Z",
  "level": "info",
  "message": "Request received",
  "service": "test-datadog-crud-api",
  "dd.trace_id": "1234567890",
  "dd.span_id": "9876543210",
  "http.method": "GET",
  "http.url": "/api/products",
  "http.status_code": 200
}
```

### Log Levels

- `error`: Application errors, exceptions
- `warn`: Warnings, degraded performance
- `info`: General information, request logs
- `debug`: Detailed debugging information

### Filtering Logs

**By level**:
```
service:test-datadog-crud-api status:error
service:test-datadog-crud-api status:warn
```

**By endpoint**:
```
service:test-datadog-crud-api @http.url:"/api/products"
```

**By status code**:
```
service:test-datadog-crud-api @http.status_code:500
```

**By time range**:
- Use time selector in top-right
- Options: Last 15m, 1h, 4h, 1d, custom

### Log Patterns

**Access**: Logs → Patterns

Datadog automatically groups similar logs:
- Identify recurring patterns
- Detect anomalies
- Track pattern frequency

### Log Analytics

**Access**: Logs → Analytics

Create visualizations:
- Request count over time
- Error rate trends
- Top endpoints by request count
- Average response time

## 4. Infrastructure Monitoring

### Container Monitoring

**Access**: Infrastructure → Containers

View:
- Running containers/tasks
- CPU usage
- Memory usage
- Network I/O
- Disk I/O

### Host Metrics

**Access**: Infrastructure → Host Map

Shows:
- Container/host health
- Resource utilization
- Live metrics

### ECS Integration (AWS Deployment)

**Access**: Infrastructure → ECS

View:
- ECS clusters
- Services
- Tasks
- Container instances
- Auto-scaling events

## 5. Runtime Metrics

The application sends Node.js runtime metrics:

**CPU Metrics**:
- `runtime.node.cpu.user`
- `runtime.node.cpu.system`

**Memory Metrics**:
- `runtime.node.mem.heap_used`
- `runtime.node.mem.heap_total`
- `runtime.node.mem.rss`
- `runtime.node.mem.external`

**Event Loop**:
- `runtime.node.event_loop.delay.avg`
- `runtime.node.event_loop.delay.max`

**Garbage Collection**:
- `runtime.node.gc.pause`
- `runtime.node.gc.count`

**View in**: Metrics → Explorer

## 6. Custom Dashboards

### Creating a Dashboard

1. Go to **Dashboards → New Dashboard**
2. Name it (e.g., "Datadog Playground - Overview")
3. Add widgets

### Recommended Widgets

**Request Rate**:
- Metric: `trace.express.request`
- Visualization: Timeseries
- Group by: `resource_name`

**Latency Percentiles**:
- Metric: `trace.express.request.duration`
- Visualization: Timeseries
- Aggregation: p50, p95, p99

**Error Rate**:
- Metric: `trace.express.request.errors`
- Visualization: Query Value or Timeseries
- Alert threshold: > 0

**Request by Endpoint**:
- Metric: `trace.express.request`
- Visualization: Top List
- Group by: `resource_name`

**Memory Usage**:
- Metric: `runtime.node.mem.heap_used`
- Visualization: Timeseries

**CPU Usage**:
- Metric: `runtime.node.cpu.user`
- Visualization: Timeseries

### Dashboard Template

Create a dashboard with these sections:

1. **Overview**
   - Total requests (query value)
   - Error rate % (query value)
   - Avg latency (query value)

2. **Request Metrics**
   - Requests per second (timeseries)
   - Requests by endpoint (top list)

3. **Performance**
   - Latency percentiles (timeseries: p50, p75, p95, p99)
   - Slowest endpoints (top list)

4. **Errors**
   - Error count (timeseries)
   - Errors by type (top list)

5. **Infrastructure**
   - CPU usage (timeseries)
   - Memory usage (timeseries)
   - Event loop delay (timeseries)

## 7. Monitors and Alerts

### Creating Monitors

**Access**: Monitors → New Monitor

### Monitor Examples

**High Error Rate**:
- Type: Metric Monitor
- Metric: `trace.express.request.errors`
- Alert threshold: > 10 errors in 5 minutes
- Warning threshold: > 5 errors in 5 minutes

**High Latency**:
- Type: Metric Monitor
- Metric: `trace.express.request.duration`
- Aggregation: p95
- Alert threshold: > 2 seconds
- Warning threshold: > 1 second

**Service Down**:
- Type: Metric Monitor
- Metric: `trace.express.request`
- Alert: No data for 5 minutes

**High Memory Usage**:
- Type: Metric Monitor
- Metric: `runtime.node.mem.heap_used`
- Alert threshold: > 400 MB
- Warning threshold: > 300 MB

### Notification Channels

Configure in monitor settings:
- Email
- Slack
- PagerDuty
- Webhook
- Microsoft Teams

## 8. Service Level Objectives (SLOs)

### Creating an SLO

**Access**: Service Management → SLOs → New SLO

### Example SLOs

**Availability SLO**:
- Type: Metric-based
- Metric: `trace.express.request`
- Good events: status code 200-399
- Target: 99% over 30 days

**Latency SLO**:
- Type: Metric-based
- Metric: `trace.express.request.duration`
- Good events: p95 < 1 second
- Target: 95% over 30 days

### SLO Benefits

- Track error budget
- Prioritize reliability work
- Set performance targets
- Visualize reliability trends

## 9. Continuous Profiling

The application has profiling enabled.

**Access**: APM → Profiling

**View**:
- CPU usage by function
- Memory allocation
- Function call frequency
- Flame graphs

**Use cases**:
- Identify performance bottlenecks
- Find memory leaks
- Optimize hot code paths

## 10. Synthetics (Optional)

Create synthetic tests to monitor from outside:

**Access**: Synthetic Monitoring → New Test

**Test types**:
- HTTP test (ping endpoints)
- Browser test (simulate user flows)
- API test (multi-step API checks)

**Example HTTP Test**:
- URL: `http://your-alb-url/health`
- Check interval: Every 5 minutes
- Locations: Multiple global locations
- Assertions: Status code = 200

## Practice Exercises

### Exercise 1: Service Overview

1. Go to APM → Services
2. Find your service
3. Note: request rate, latency p95, error rate
4. Click into service details
5. Identify the slowest endpoint

### Exercise 2: Trace Investigation

1. Generate traffic with `scenario=long-latency`
2. Go to APM → Traces
3. Filter by `service:test-datadog-crud-api`
4. Sort by duration (slowest first)
5. Click on a slow trace
6. Examine the flame graph
7. Find correlated logs

### Exercise 3: Log Analysis

1. Go to Logs → Explorer
2. Filter: `service:test-datadog-crud-api`
3. Group by `status` to see error vs info
4. Click on an error log
5. Find and click the trace ID
6. Examine the full request context

### Exercise 4: Create a Dashboard

1. Create a new dashboard
2. Add 6 widgets (see recommendations above)
3. Save the dashboard
4. Generate traffic and watch metrics update

### Exercise 5: Set Up Alerts

1. Create a high error rate monitor
2. Set alert threshold at 5 errors/5min
3. Add email notification
4. Generate error traffic to trigger
5. Verify alert received

## Troubleshooting Monitoring

### No Data in Datadog

1. **Check agent status**:
   ```bash
   docker exec datadog-agent agent status
   ```

2. **Verify API key**:
   - Look for "API Key: Valid" in agent status

3. **Check tracer initialization**:
   - Tracer must load before Express (see `src/index.ts`)

4. **Check connectivity**:
   ```bash
   # Test port
   nc -zv localhost 8126
   ```

### Missing Traces

1. **Check DD_AGENT_HOST**:
   - Local: `localhost`
   - Docker Compose: `datadog-agent`
   - ECS: Should be `localhost` (sidecar pattern)

2. **Enable debug logs**:
   ```bash
   export DD_TRACE_DEBUG=true
   pnpm dev
   ```

### Missing Logs

1. **Check log injection**:
   - Should see `dd.trace_id` in logs

2. **Verify agent logs config**:
   ```bash
   docker exec datadog-agent agent status
   # Look for "Logs Agent"
   ```

## Next Steps

- [Testing Guide](./testing.md) - Generate traffic to monitor
- [Deployment Guide](./deployment.md) - Deploy to AWS for production monitoring
- [Datadog Documentation](https://docs.datadoghq.com/) - Official docs
