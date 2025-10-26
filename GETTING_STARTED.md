# Getting Started - Local Development with Datadog

This guide will get you up and running in **5 minutes** with Datadog monitoring on your laptop.

## TL;DR - Fastest Path

```bash
# 1. Run setup script
./setup-local.sh

# 2. Choose option 1 (Docker Compose) when prompted

# 3. Enter your Datadog API key

# 4. Test it
curl http://localhost:3000/api/products

# 5. View in Datadog
# Visit: https://app.datadoghq.com/apm/services
```

That's it! 🎉

---

## Step-by-Step Guide

### Step 1: Get Your Datadog API Key

1. Go to https://app.datadoghq.com/ (create free account if needed)
2. Navigate to: **Organization Settings** → **API Keys**
3. Copy your API key or create a new one

### Step 2: Choose Your Setup Method

#### 🎯 Recommended: Docker Compose

**Pros**: Easiest, most reliable, works everywhere
**Cons**: Requires Docker

```bash
# Set your API key
export DD_API_KEY=your-datadog-api-key-here

# Start everything
docker-compose up

# Test (in another terminal)
curl http://localhost:3000/api/products
```

#### 🚀 Alternative: Local Node.js + Docker Agent

**Pros**: App runs natively (faster restarts), easier debugging
**Cons**: Requires Docker for agent

```bash
# Start Datadog agent
docker run -d --name datadog-agent \
  -e DD_API_KEY=your-key \
  -e DD_SITE=datadoghq.com \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -p 8126:8126 -p 8125:8125/udp \
  gcr.io/datadoghq/agent:latest

# Install dependencies
npm install

# Start your app
npm run dev
```

#### 🔧 Advanced: Native Agent on Laptop

**Pros**: No Docker needed, runs as system service
**Cons**: Requires system-level installation

See [LOCAL_SETUP.md](LOCAL_SETUP.md) for detailed instructions.

### Step 3: Verify Everything Works

#### Check Application
```bash
# Health check
curl http://localhost:3000/health
# Should return: {"status":"healthy",...}

# Get products
curl http://localhost:3000/api/products
# Should return: {"success":true,"count":5,...}
```

#### Check Datadog Agent

**Docker Compose:**
```bash
docker-compose exec datadog-agent agent status
```

**Docker Agent:**
```bash
docker exec datadog-agent agent status
```

Look for:
- ✅ **API Key**: Valid
- ✅ **APM Agent**: Running
- ✅ **Logs Agent**: Running

### Step 4: Test Scenarios

Run the test script:
```bash
./test-scenarios.sh
```

Or test manually:
```bash
# Normal request
curl http://localhost:3000/api/products

# Trigger an error
curl http://localhost:3000/api/products?scenario=error

# Test latency
time curl http://localhost:3000/api/products?scenario=long-latency
```

### Step 5: Explore Datadog Dashboard

#### APM - Application Performance Monitoring
1. Go to: https://app.datadoghq.com/apm/services
2. Find service: `test-datadog-crud-api`
3. Explore:
   - Request rate
   - Latency (p50, p75, p95, p99)
   - Error rate
   - Individual traces

#### Logs
1. Go to: https://app.datadoghq.com/logs
2. Filter by: `service:test-datadog-crud-api`
3. Notice:
   - Structured JSON logs
   - Trace IDs in logs
   - Click trace ID to jump to APM

#### Infrastructure
1. Go to: https://app.datadoghq.com/infrastructure
2. Find your host/container
3. View metrics:
   - CPU usage
   - Memory usage
   - Runtime metrics

---

## Common Tasks

### Generate Traffic for Testing

```bash
# Generate normal traffic
for i in {1..100}; do
  curl -s http://localhost:3000/api/products > /dev/null &
done

# Generate errors
for i in {1..50}; do
  curl -s http://localhost:3000/api/products?scenario=error > /dev/null &
done

# Generate latency issues
for i in {1..20}; do
  curl -s http://localhost:3000/api/products?scenario=random-latency > /dev/null &
done
```

### View Logs

**Docker Compose:**
```bash
# App logs
docker-compose logs -f app

# Agent logs
docker-compose logs -f datadog-agent
```

**Local Node.js:**
```bash
# App logs appear in terminal
# Agent logs:
docker logs -f datadog-agent
```

### Stop Everything

**Docker Compose:**
```bash
docker-compose down
```

**Docker Agent + Local App:**
```bash
# Stop app: Ctrl+C in terminal
# Stop agent:
docker stop datadog-agent
docker rm datadog-agent
```

---

## What to Practice in Datadog

### 1. APM & Distributed Tracing
- [ ] View service map
- [ ] Analyze latency percentiles
- [ ] Drill into slow traces
- [ ] Compare traces with different scenarios

### 2. Logging
- [ ] Filter logs by severity
- [ ] Search for specific messages
- [ ] Correlate logs with traces (click trace ID)
- [ ] Create log patterns

### 3. Metrics & Monitoring
- [ ] View runtime metrics (CPU, memory)
- [ ] Create custom dashboard
- [ ] Add widgets for key metrics
- [ ] Set up percentile graphs

### 4. Alerting
- [ ] Create error rate monitor
- [ ] Create latency monitor (p95 > threshold)
- [ ] Set up notification channels
- [ ] Test alert by triggering scenarios

### 5. Service Level Objectives (SLOs)
- [ ] Define SLI (Service Level Indicator)
- [ ] Create SLO (e.g., 99% requests < 1s)
- [ ] Track error budget
- [ ] Set up SLO alerts

---

## Troubleshooting

### "Connection refused" to Datadog Agent

**Check agent is running:**
```bash
# Docker Compose
docker-compose ps

# Docker only
docker ps | grep datadog

# Test port
nc -zv localhost 8126
```

**Fix:**
```bash
# Restart agent
docker-compose restart datadog-agent
# or
docker restart datadog-agent
```

### No Data in Datadog

**Wait 1-2 minutes** - Data takes time to appear

**Check agent status:**
```bash
docker-compose exec datadog-agent agent status
# Look for "API Key" and "Running Checks"
```

**Verify environment variables:**
```bash
# In your app terminal
node -e "console.log(process.env.DD_AGENT_HOST, process.env.DD_TRACE_AGENT_PORT)"
# Should show: localhost 8126
```

### Port 3000 Already in Use

```bash
# Find what's using it
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port
export PORT=3001
npm run dev
```

### TypeScript/Build Errors

```bash
# Clean everything
rm -rf node_modules dist

# Reinstall
npm install

# Rebuild
npm run build
```

---

## Next Steps

1. ✅ Get everything running locally
2. ✅ Test different scenarios
3. ✅ Explore Datadog dashboards
4. 📚 Learn more:
   - Create custom metrics
   - Set up monitors and alerts
   - Practice incident investigation
   - Deploy to AWS ECS (see README.md)

---

## Resources

- **Full Documentation**: [README.md](README.md)
- **Local Setup Details**: [LOCAL_SETUP.md](LOCAL_SETUP.md)
- **Quick Reference**: [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **Datadog Docs**: https://docs.datadoghq.com/
- **HTTP Examples**: [api-examples.http](api-examples.http)

---

## Getting Help

**Can't get it working?**

1. Check Docker is running: `docker --version`
2. Check Node.js version: `node --version` (need 18+)
3. Review agent status: `docker exec datadog-agent agent status`
4. Check app logs: `docker-compose logs app`
5. Enable debug mode: `export DD_TRACE_DEBUG=true && npm run dev`

---

Ready to start? Run: `./setup-local.sh` 🚀
