# Quick Reference Card

## Start Application

### Docker Compose (Recommended)
```bash
export DD_API_KEY=your-key
docker-compose up
```

### Local Node.js + Docker Agent
```bash
# Terminal 1: Start agent
docker run -d --name datadog-agent \
  -e DD_API_KEY=your-key -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -p 8126:8126 -p 8125:8125/udp \
  gcr.io/datadoghq/agent:latest

# Terminal 2: Start app
npm run dev
```

### Native Setup
```bash
npm run dev
```

## Test Endpoints

### Basic CRUD
```bash
# Get all products
curl http://localhost:3000/api/products

# Get one product
curl http://localhost:3000/api/products/1

# Create product
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","price":99.99,"category":"Test","stock":10}'

# Update product
curl -X PUT http://localhost:3000/api/products/1 \
  -H "Content-Type: application/json" \
  -d '{"price":149.99}'

# Delete product
curl -X DELETE http://localhost:3000/api/products/1
```

### Scenarios
```bash
# Error (400)
curl http://localhost:3000/api/products?scenario=error

# Internal Error (500)
curl http://localhost:3000/api/products?scenario=internal-error

# Long Latency (5s)
curl http://localhost:3000/api/products?scenario=long-latency

# Random Latency (100ms-3s)
curl http://localhost:3000/api/products?scenario=random-latency

# Timeout (30s)
curl http://localhost:3000/api/products?scenario=timeout
```

### Run All Tests
```bash
./test-scenarios.sh
```

## Check Status

### Docker Compose
```bash
# App logs
docker-compose logs -f app

# Agent logs
docker-compose logs -f datadog-agent

# Agent status
docker-compose exec datadog-agent agent status

# Stop
docker-compose down
```

### Docker Agent Only
```bash
# Agent status
docker exec datadog-agent agent status

# Agent logs
docker logs -f datadog-agent

# Stop agent
docker stop datadog-agent
docker rm datadog-agent
```

### Native Agent
```bash
# macOS/Linux
datadog-agent status
sudo systemctl status datadog-agent  # Linux systemd

# Windows (PowerShell as Admin)
& "C:\Program Files\Datadog\Datadog Agent\bin\agent.exe" status
```

## Datadog Dashboard Links

- **APM Services**: https://app.datadoghq.com/apm/services
- **Logs**: https://app.datadoghq.com/logs
- **Infrastructure**: https://app.datadoghq.com/infrastructure
- **Metrics Explorer**: https://app.datadoghq.com/metric/explorer
- **Service Map**: https://app.datadoghq.com/apm/map

### Filter in Datadog
```
service:test-datadog-crud-api
```

## Generate Load

```bash
# Normal traffic
for i in {1..100}; do curl http://localhost:3000/api/products & done

# Error traffic
for i in {1..50}; do curl http://localhost:3000/api/products?scenario=error & done

# Latency traffic
for i in {1..20}; do curl http://localhost:3000/api/products?scenario=random-latency & done
```

## Available Scenarios

| Scenario | Description | Example |
|----------|-------------|---------|
| `normal` | No delay (default) | `?scenario=normal` |
| `error` | 400 Bad Request | `?scenario=error` |
| `internal-error` | 500 Server Error | `?scenario=internal-error` |
| `long-latency` | 5 second delay | `?scenario=long-latency` |
| `random-latency` | Random 100ms-3s | `?scenario=random-latency` |
| `timeout` | 30 second delay | `?scenario=timeout` |

## NPM Scripts

```bash
npm run dev           # Run with .env file loaded
npm run dev:docker    # Run for Docker (no .env)
npm run start:local   # Run without nodemon
npm run build         # Build TypeScript
npm start             # Run built version
```

## Troubleshooting

### Port 3000 in use
```bash
lsof -i :3000
kill -9 <PID>
```

### Agent not receiving data
```bash
# Check connectivity
nc -zv localhost 8126
telnet localhost 8126

# Enable debug logs
export DD_TRACE_DEBUG=true
npm run dev
```

### Reset everything
```bash
# Docker Compose
docker-compose down -v

# Docker agent only
docker stop datadog-agent
docker rm datadog-agent

# Clean build
rm -rf node_modules dist
npm install
```

## Environment Variables (.env)

```bash
PORT=3000
NODE_ENV=development
DD_SERVICE=test-datadog-crud-api
DD_ENV=local
DD_VERSION=1.0.0
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_PORT=8126
DD_LOGS_INJECTION=true
DD_RUNTIME_METRICS_ENABLED=true
DD_PROFILING_ENABLED=true
```

## Useful Files

- `LOCAL_SETUP.md` - Detailed local setup guide
- `QUICKSTART.md` - Quick start for all deployment methods
- `README.md` - Full documentation
- `api-examples.http` - HTTP request examples for VS Code
- `test-scenarios.sh` - Automated testing script
- `setup-local.sh` - Interactive setup script
