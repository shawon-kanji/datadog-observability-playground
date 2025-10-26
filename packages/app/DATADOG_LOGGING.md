# Datadog Logging and APM Guide

This guide explains how APM traces and logs work with Datadog in this application.

## 📊 How APM Traces Work

### Automatic Trace Collection

**You DON'T need to do anything special!** Traces are automatically captured.

#### How it Works:

1. **Tracer Initialization** (`src/tracer.ts`):
   ```typescript
   import tracer from 'dd-trace';
   tracer.init({ ... });
   ```

2. **Import Order Matters**:
   - `src/app.ts` imports tracer **FIRST** before any other modules
   - This ensures all HTTP requests, database calls, etc. are automatically traced

3. **Automatic Instrumentation**:
   - Express routes are auto-traced
   - HTTP requests are auto-traced
   - Database queries are auto-traced (if you add DB)
   - No manual span creation needed!

#### What Gets Traced:

- ✅ All HTTP requests (method, path, status code, duration)
- ✅ Express middleware execution
- ✅ Route handlers
- ✅ Async operations
- ✅ Error stack traces

#### View Traces in Datadog:

1. Go to **APM → Services**
2. Find `test-datadog-crud-api`
3. Click on any request to see the flame graph

---

## 📝 How Logging Works

### Log Collection Flow

```
Your App (console.log)
    ↓ (stdout/stderr)
Docker/ECS Container
    ↓ (log driver)
Datadog Agent
    ↓ (API)
Datadog Platform
```

### Log-Trace Correlation

**The Magic**: Logs now include `trace_id` and `span_id`!

#### Updated Logger (`src/logger.ts`):

```typescript
private getTraceContext() {
  const span = tracer.scope().active();
  if (span) {
    return {
      dd: {
        trace_id: spanContext.toTraceId(),
        span_id: spanContext.toSpanId(),
      }
    };
  }
  return {};
}
```

#### Log Output Example:

```json
{
  "timestamp": "2025-10-26T12:00:00.000Z",
  "level": "info",
  "service": "test-datadog-crud-api",
  "env": "dev",
  "message": "HTTP Request",
  "dd": {
    "trace_id": "1234567890123456789",
    "span_id": "9876543210987654"
  },
  "context": {
    "method": "GET",
    "path": "/api/products",
    "statusCode": 200
  }
}
```

---

## 🐳 Docker/Docker Compose Setup

### Current Configuration

**docker-compose.yml** already has the correct setup:

```yaml
datadog-agent:
  environment:
    - DD_LOGS_ENABLED=true
    - DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true
```

### How Logs Are Collected:

1. **Your app writes to stdout/stderr** (console.log)
2. **Docker captures container logs**
3. **Datadog agent reads container logs** via Docker socket
4. **Agent forwards to Datadog** with enrichment

### No Log Files Needed!

- ❌ You DON'T need to configure log file paths
- ❌ You DON'T need log rotation
- ✅ Just use `console.log()` and logs are automatically collected

---

## ☁️ AWS ECS Setup

### How It Works in ECS:

1. **App writes to stdout/stderr**
2. **ECS sends logs to CloudWatch Logs**
3. **Datadog agent sidecar** reads from CloudWatch
4. **Logs are forwarded to Datadog**

### Configuration (Already Done):

In `packages/cdk/lib/datadog-app-stack.ts`:

```typescript
// App container
logging: ecs.LogDriver.awsLogs({
  streamPrefix: 'app',
  logGroup: appLogGroup,
}),

// Datadog agent configured to collect logs
environment: {
  DD_LOGS_ENABLED: 'true',
  ECS_FARGATE: 'true',
}
```

---

## 🔍 Verifying Log-Trace Correlation

### 1. Generate Traffic:

```bash
curl http://localhost:3000/api/products
```

### 2. Check Logs in Terminal:

You should see JSON logs with `dd.trace_id` and `dd.span_id`:

```json
{
  "timestamp": "...",
  "level": "info",
  "dd": {
    "trace_id": "...",
    "span_id": "..."
  },
  "message": "HTTP Request"
}
```

### 3. View in Datadog:

**In APM → Traces:**
- Click on any trace
- Click "View Logs" button
- See correlated logs automatically!

**In Logs → Search:**
- Search: `service:test-datadog-crud-api`
- Click any log entry
- Click "View Trace" to jump to the trace!

---

## 🎯 Local Development

### Option 1: Docker Compose (Recommended)

```bash
cd packages/app
export DD_API_KEY=your-key
docker-compose up
```

**Logs and traces automatically forwarded!**

### Option 2: Local Node + Docker Agent

```bash
# Start Datadog agent
docker run -d --name datadog-agent \
  -e DD_API_KEY=your-key \
  -e DD_SITE=datadoghq.com \
  -e DD_APM_ENABLED=true \
  -e DD_LOGS_ENABLED=true \
  -e DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -p 8126:8126 -p 8125:8125/udp \
  gcr.io/datadoghq/agent:latest

# Run app
pnpm dev
```

**Note**: With local Node.js, logs go to your terminal but NOT to Datadog (unless you configure the agent to tail files).

For local dev, traces work but logs only visible in Datadog when using Docker.

### Option 3: Log File Collection (Advanced)

If you want logs in Datadog while running locally:

1. **Create log file output** (add to logger.ts):
   ```typescript
   fs.appendFileSync('/var/log/app.log', logEntry + '\n');
   ```

2. **Configure Datadog agent** to tail the file:
   ```yaml
   # datadog.yaml
   logs:
     - type: file
       path: /var/log/app.log
       service: test-datadog-crud-api
       source: nodejs
   ```

**But this is NOT recommended** - use Docker Compose instead!

---

## 🧪 Testing Log-Trace Correlation

### 1. Run the app:
```bash
docker-compose up
```

### 2. Generate requests with different scenarios:
```bash
# Normal request
curl http://localhost:3000/api/products

# Error scenario
curl "http://localhost:3000/api/products?scenario=error"

# Internal error
curl "http://localhost:3000/api/products?scenario=internal-error"
```

### 3. Check Datadog:

**APM View:**
1. Go to APM → Services → `test-datadog-crud-api`
2. Click on traces with errors (red)
3. Click "View Logs" to see correlated error logs

**Logs View:**
1. Go to Logs
2. Filter: `service:test-datadog-crud-api status:error`
3. Click any error log
4. Click "View Trace" to see the full trace

---

## ✅ Key Takeaways

### APM Traces:
- ✅ Already working automatically
- ✅ No special run command needed
- ✅ Tracer initialized in `src/tracer.ts`
- ✅ Just run `pnpm dev` or Docker

### Logs:
- ✅ Use `console.log()` - it works!
- ✅ Logs automatically collected in Docker/ECS
- ✅ **NOW INCLUDES** `trace_id` and `span_id` for correlation
- ❌ No log file configuration needed
- ❌ No log rotation needed

### Log-Trace Correlation:
- ✅ Logs and traces linked automatically
- ✅ Click "View Logs" in traces
- ✅ Click "View Trace" in logs
- ✅ See full context of requests

---

## 🚨 Common Issues

### "I don't see traces in Datadog"

**Check:**
1. Is DD_API_KEY set correctly?
2. Is Datadog agent running?
3. Check agent status:
   ```bash
   docker exec datadog-agent agent status
   ```
4. Is DD_AGENT_HOST correct? (localhost or datadog-agent)

### "I don't see logs in Datadog"

**Check:**
1. In Docker: Is DD_LOGS_ENABLED=true on agent?
2. Logs might take 30-60 seconds to appear
3. Check agent logs:
   ```bash
   docker logs datadog-agent
   ```

### "Logs and traces are not correlated"

**Check:**
1. Logger updated with `getTraceContext()`?
2. Is `logInjection: true` in tracer.init()?
3. Are logs in JSON format?
4. Check log contains `dd.trace_id` field

---

## 📚 Further Reading

- [Datadog APM Documentation](https://docs.datadoghq.com/tracing/)
- [Datadog Log Management](https://docs.datadoghq.com/logs/)
- [Correlating Logs and Traces](https://docs.datadoghq.com/tracing/other_telemetry/connect_logs_and_traces/)
- [dd-trace Node.js](https://docs.datadoghq.com/tracing/trace_collection/dd_libraries/nodejs/)
