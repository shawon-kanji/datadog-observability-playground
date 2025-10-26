# Local Setup Guide - Running Datadog Agent on Your Laptop

This guide covers running the application and Datadog agent directly on your laptop (without ECS or full Docker setup).

## Table of Contents
1. [Option 1: Docker Compose (Easiest)](#option-1-docker-compose-easiest)
2. [Option 2: Native Datadog Agent + Node.js App](#option-2-native-datadog-agent--nodejs-app)
3. [Option 3: Dockerized Agent + Local Node.js App](#option-3-dockerized-agent--local-nodejs-app)

---

## Option 1: Docker Compose (Easiest)

This is the **recommended approach** for local testing as it's the simplest.

### Setup

```bash
# 1. Set your Datadog API key
export DD_API_KEY=your-datadog-api-key-here

# 2. Start both the app and Datadog agent
docker-compose up

# 3. In another terminal, test the API
curl http://localhost:3000/api/products

# 4. Run scenario tests
./test-scenarios.sh
```

### What's Running?
- **App Container**: Your Node.js API on port 3000
- **Datadog Agent Container**: Receives traces on port 8126, metrics on port 8125

### View Logs
```bash
# View app logs
docker-compose logs -f app

# View Datadog agent logs
docker-compose logs -f datadog-agent

# Check agent status
docker-compose exec datadog-agent agent status
```

### Stop
```bash
docker-compose down
```

---

## Option 2: Native Datadog Agent + Node.js App

Run both the Datadog agent and your app natively on your laptop (no Docker).

### Step 1: Install Datadog Agent on Your Laptop

#### macOS
```bash
DD_API_KEY=your-api-key-here bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_mac_os.sh)"
```

#### Linux (Ubuntu/Debian)
```bash
DD_API_KEY=your-api-key-here DD_SITE="datadoghq.com" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"
```

#### Windows
Download and run the installer from: https://www.datadoghq.com/

### Step 2: Configure Datadog Agent for APM

Edit the Datadog configuration file:

**macOS:**
```bash
sudo vi /opt/datadog-agent/etc/datadog.yaml
```

**Linux:**
```bash
sudo vi /etc/datadog-agent/datadog.yaml
```

**Windows:**
```
C:\ProgramData\Datadog\datadog.yaml
```

Add/update these settings:
```yaml
api_key: your-api-key-here
site: datadoghq.com

# Enable APM
apm_config:
  enabled: true
  apm_non_local_traffic: false

# Enable logs
logs_enabled: true
logs_config:
  container_collect_all: true

# Enable process monitoring
process_config:
  enabled: true
```

### Step 3: Start Datadog Agent

**macOS:**
```bash
# Start agent
launchctl start com.datadoghq.agent

# Check status
datadog-agent status

# View logs
tail -f /opt/datadog-agent/logs/agent.log
```

**Linux:**
```bash
# Start agent
sudo systemctl start datadog-agent

# Check status
sudo datadog-agent status

# View logs
sudo tail -f /var/log/datadog/agent.log
```

**Windows (PowerShell as Administrator):**
```powershell
# Start service
Start-Service -Name datadogagent

# Check status
& "C:\Program Files\Datadog\Datadog Agent\bin\agent.exe" status
```

### Step 4: Create Local Environment File

```bash
# Create .env file
cat > .env << 'EOF'
PORT=3000
NODE_ENV=development

# Datadog Configuration
DD_SERVICE=test-datadog-crud-api
DD_ENV=local
DD_VERSION=1.0.0
DD_AGENT_HOST=127.0.0.1
DD_TRACE_AGENT_PORT=8126
DD_LOGS_INJECTION=true
DD_RUNTIME_METRICS_ENABLED=true
DD_PROFILING_ENABLED=true
EOF
```

### Step 5: Install dotenv Package

```bash
npm install dotenv
```

Update `src/server.ts` to load environment variables:

```bash
# Create a new file to load env vars first
cat > src/index.ts << 'EOF'
// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

// Then start the server
import './server';
EOF
```

### Step 6: Update package.json

```bash
# Update the dev script
npm pkg set scripts.dev="nodemon --exec ts-node src/index.ts"
npm pkg set scripts.start:local="ts-node src/index.ts"
```

### Step 7: Run Your Application

```bash
# Install dependencies (if not done)
npm install

# Run in development mode
npm run dev

# Or run directly
npm run start:local
```

### Step 8: Test the Setup

```bash
# In another terminal, test the API
curl http://localhost:3000/api/products

# Run scenario tests
./test-scenarios.sh

# Check Datadog agent is receiving data
datadog-agent status
```

### Step 9: View Data in Datadog

1. Go to https://app.datadoghq.com/apm/services
2. You should see `test-datadog-crud-api` service
3. Click on it to view traces, metrics, and logs

---

## Option 3: Dockerized Agent + Local Node.js App

Run the Datadog agent in Docker, but run your Node.js app natively.

### Step 1: Start Datadog Agent in Docker

```bash
docker run -d \
  --name datadog-agent \
  -e DD_API_KEY=your-api-key-here \
  -e DD_SITE=datadoghq.com \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -e DD_LOGS_ENABLED=true \
  -e DD_PROCESS_AGENT_ENABLED=true \
  -p 8126:8126 \
  -p 8125:8125/udp \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /proc/:/host/proc/:ro \
  -v /sys/fs/cgroup/:/host/sys/fs/cgroup:ro \
  gcr.io/datadoghq/agent:latest
```

### Step 2: Create .env File

```bash
cat > .env << 'EOF'
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
EOF
```

### Step 3: Install Dependencies and Run

```bash
# Install dotenv if not already installed
npm install dotenv

# Create index.ts (if not exists from Option 2)
cat > src/index.ts << 'EOF'
import dotenv from 'dotenv';
dotenv.config();
import './server';
EOF

# Update package.json script
npm pkg set scripts.dev="nodemon --exec ts-node src/index.ts"

# Run the application
npm run dev
```

### Step 4: Test

```bash
# Test API
curl http://localhost:3000/api/products

# Run tests
./test-scenarios.sh

# Check agent status
docker exec datadog-agent agent status
```

### Step 5: Stop Agent

```bash
docker stop datadog-agent
docker rm datadog-agent
```

---

## Verification Checklist

After setting up, verify everything works:

### 1. Check Agent Status

**Docker Compose:**
```bash
docker-compose exec datadog-agent agent status
```

**Native Agent:**
```bash
datadog-agent status  # macOS/Linux
# Or on Windows
& "C:\Program Files\Datadog\Datadog Agent\bin\agent.exe" status
```

**Docker Only:**
```bash
docker exec datadog-agent agent status
```

Look for:
- ✅ API Key status: Valid
- ✅ APM Agent: Running
- ✅ Logs Agent: Running

### 2. Check Application

```bash
# Health check
curl http://localhost:3000/health

# Get products
curl http://localhost:3000/api/products

# Trigger error
curl http://localhost:3000/api/products?scenario=error

# Test latency
time curl http://localhost:3000/api/products?scenario=long-latency
```

### 3. Check Datadog Dashboard

1. **APM**: https://app.datadoghq.com/apm/services
   - Look for `test-datadog-crud-api`

2. **Logs**: https://app.datadoghq.com/logs
   - Filter: `service:test-datadog-crud-api`

3. **Infrastructure**: https://app.datadoghq.com/infrastructure
   - Check host/container metrics

---

## Troubleshooting

### Agent Not Receiving Data

```bash
# Check if agent is listening on port 8126
lsof -i :8126

# Check application environment variables
node -e "console.log(process.env.DD_AGENT_HOST, process.env.DD_TRACE_AGENT_PORT)"

# Enable debug logging in your app
export DD_TRACE_DEBUG=true
npm run dev
```

### Connection Refused Error

This usually means the agent isn't running or is on the wrong host/port.

```bash
# Test connectivity to agent
telnet localhost 8126

# Or
nc -zv localhost 8126
```

### No Traces Appearing

1. Make sure tracer is initialized **before** other imports (check `src/app.ts`)
2. Verify `DD_AGENT_HOST` and `DD_TRACE_AGENT_PORT`
3. Check agent status shows APM is enabled
4. Wait 1-2 minutes for data to appear in Datadog

### Port 3000 Already in Use

```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
export PORT=3001
npm run dev
```

---

## Recommended Setup for Development

For the **best local development experience**, I recommend **Option 1 (Docker Compose)** because:

✅ Easiest to set up
✅ Consistent environment
✅ Easy to start/stop
✅ No system-wide agent installation
✅ Easy to clean up

However, if you prefer running Node.js natively, **Option 3** (Dockerized Agent + Local Node.js) is a good middle ground.

---

## Next Steps

1. Choose your setup option above
2. Start the agent and application
3. Run `./test-scenarios.sh` to generate sample data
4. Explore Datadog dashboards
5. Create custom monitors and alerts
6. Practice incident investigation

Happy monitoring! 🚀
