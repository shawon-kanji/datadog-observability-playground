# Kubernetes Probes: Liveness and Readiness Guide

This guide explains the difference between liveness and readiness probes and when to use each.

## Table of Contents

1. [Overview](#overview)
2. [Liveness Probe](#liveness-probe)
3. [Readiness Probe](#readiness-probe)
4. [Key Differences](#key-differences)
5. [Probe Types](#probe-types)
6. [Configuration Parameters](#configuration-parameters)
7. [Best Practices](#best-practices)
8. [Common Scenarios](#common-scenarios)

---

## Overview

Kubernetes uses **probes** to check the health of your containers and take appropriate actions.

```
┌────────────────────────────────────────────────────────────────┐
│ Kubernetes Health Check System                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Liveness Probe                      Readiness Probe           │
│  ───────────────                     ────────────────          │
│  "Is the app alive?"                 "Can it handle traffic?"  │
│                                                                 │
│  ✅ Pass → Keep running              ✅ Pass → Send traffic    │
│  ❌ Fail → Restart container         ❌ Fail → Stop traffic    │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Liveness Probe

### Purpose

**Answers**: "Is the container alive and functioning?"

**Action on failure**: **Restart the container**

### When to Use

Use liveness probe to detect:
- ❌ Deadlocks (app is frozen)
- ❌ Infinite loops
- ❌ Unrecoverable errors
- ❌ Memory leaks causing OOM

### Example

```yaml
livenessProbe:
  httpGet:
    path: /health      # Health check endpoint
    port: 3000
  initialDelaySeconds: 30   # Wait 30s for app to start
  periodSeconds: 10         # Check every 10s
  timeoutSeconds: 5         # Wait max 5s for response
  failureThreshold: 3       # Restart after 3 consecutive failures
```

### What Happens When It Fails

```
Time    Action
────────────────────────────────────────────────────────
0s      Container starts
30s     First liveness check (initialDelaySeconds)
40s     Check passes ✅
50s     Check passes ✅
60s     Check FAILS ❌ (failure count: 1/3)
70s     Check FAILS ❌ (failure count: 2/3)
80s     Check FAILS ❌ (failure count: 3/3)
81s     Container RESTARTED by kubelet
81s     New container starts
111s    First liveness check on new container
```

### Visualizing Liveness Probe:

```
┌──────────────────────────────────────────────────────────────┐
│ Pod: dd-app-api-689b56d449-abc12                            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Container: dd-app-api                                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ App Process                                            │  │
│  │                                                         │  │
│  │ HTTP Server listening on :3000                         │  │
│  │                                                         │  │
│  │ ❌ Deadlocked! Not responding...                       │  │
│  └────────────────────────────────────────────────────────┘  │
│         ↑                                                     │
│         │ HTTP GET /health (no response!)                    │
│         │                                                     │
│  ┌─────────────────────────────────────┐                     │
│  │ Kubelet (liveness probe)            │                     │
│  │ - Tried 3 times                     │                     │
│  │ - All failed                        │                     │
│  │ → Decision: RESTART CONTAINER       │                     │
│  └─────────────────────────────────────┘                     │
│                                                               │
│  🔄 Container restarted                                      │
│  ✅ New container running                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Readiness Probe

### Purpose

**Answers**: "Is the container ready to accept traffic?"

**Action on failure**: **Remove from Service endpoints** (stop sending traffic)

### When to Use

Use readiness probe to detect:
- 🔄 Slow startup (still initializing)
- 🔄 Dependency not ready (database connecting)
- 🔄 Temporary overload (too many requests)
- 🔄 Graceful shutdown in progress

### Example

```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10   # Wait 10s (faster than liveness)
  periodSeconds: 5          # Check every 5s (more frequent)
  timeoutSeconds: 3         # Shorter timeout
  failureThreshold: 3       # Remove from service after 3 failures
```

### What Happens When It Fails

```
Time    Action
────────────────────────────────────────────────────────
0s      Container starts
10s     First readiness check
10s     Check passes ✅ → Added to Service endpoints
        (Traffic starts flowing to this pod)
15s     Check passes ✅
20s     Check FAILS ❌ (failure count: 1/3)
25s     Check FAILS ❌ (failure count: 2/3)
30s     Check FAILS ❌ (failure count: 3/3)
30s     Pod REMOVED from Service endpoints
        (No more traffic sent to this pod)
        (Container keeps running!)
35s     Check passes ✅ (recovered!)
35s     Pod ADDED back to Service endpoints
        (Traffic resumes)
```

### Visualizing Readiness Probe:

```
┌──────────────────────────────────────────────────────────────┐
│ Service: dd-app-api-service (ClusterIP: 10.99.216.157)     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Endpoints (pods receiving traffic):                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ✅ Pod 1: 10.1.0.43:3000  (ready)                      │  │
│  │ ❌ Pod 2: 10.1.0.44:3000  (not ready - removed!)       │  │
│  │ ✅ Pod 3: 10.1.0.45:3000  (ready)                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  Traffic distribution:                                       │
│  - 50% → Pod 1                                               │
│  - 0%  → Pod 2 (readiness probe failing)                    │
│  - 50% → Pod 3                                               │
│                                                               │
└──────────────────────────────────────────────────────────────┘

Pod 2 is still running, but:
  ❌ Not receiving traffic
  ⏳ Waiting to recover
  🔄 Readiness probe keeps checking
  ✅ Will be added back when it passes
```

---

## Key Differences

| Aspect | Liveness Probe | Readiness Probe |
|--------|----------------|-----------------|
| **Question** | "Is the container alive?" | "Can it handle traffic?" |
| **Purpose** | Detect unrecoverable failures | Detect temporary unavailability |
| **Action on failure** | **Restart container** | **Remove from Service** |
| **Container state** | Killed and restarted | Keeps running |
| **Traffic impact** | Disruption during restart | Smooth (rerouted to healthy pods) |
| **Use for** | Deadlocks, crashes | Slow startup, overload, dependencies |
| **initialDelaySeconds** | Longer (30s+) | Shorter (5-10s) |
| **periodSeconds** | Less frequent (10s) | More frequent (5s) |
| **Risk if misconfigured** | Restart loops | No traffic to healthy pods |

---

## Probe Types

Kubernetes supports three types of probes:

### 1. HTTP GET (Most Common)

```yaml
livenessProbe:
  httpGet:
    path: /health        # Endpoint to check
    port: 3000          # Port number
    scheme: HTTP        # or HTTPS
    httpHeaders:        # Optional headers
    - name: Custom-Header
      value: value
```

**When to use**: When your app has an HTTP API

**Example endpoint**:
```javascript
// Express.js
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});
```

### 2. TCP Socket

```yaml
livenessProbe:
  tcpSocket:
    port: 3000
```

**When to use**: When you just need to check if port is listening (e.g., Redis, database)

**How it works**: Tries to establish TCP connection to port

### 3. Exec (Command)

```yaml
livenessProbe:
  exec:
    command:
    - cat
    - /tmp/healthy
```

**When to use**: For custom checks using shell commands

**How it works**: Runs command in container, exit code 0 = success

---

## Configuration Parameters

### initialDelaySeconds

**What**: How long to wait after container starts before first probe

```yaml
initialDelaySeconds: 30
```

**Use case**:
- Liveness: Give app time to fully start
- Readiness: Start checking quickly to begin receiving traffic

**Example**: Node.js app takes 20s to start → use `initialDelaySeconds: 30`

### periodSeconds

**What**: How often to perform the probe

```yaml
periodSeconds: 10
```

**Tradeoff**:
- Lower value (5s): Faster detection, more overhead
- Higher value (30s): Less overhead, slower detection

**Recommendation**:
- Liveness: 10-15s (less critical)
- Readiness: 5s (detect issues faster)

### timeoutSeconds

**What**: How long to wait for probe response

```yaml
timeoutSeconds: 5
```

**Important**: Should be less than `periodSeconds`

**Example**: If endpoint usually responds in 1s, use `timeoutSeconds: 3`

### failureThreshold

**What**: How many consecutive failures before taking action

```yaml
failureThreshold: 3
```

**Calculation**: Time to declare failure = `periodSeconds × failureThreshold`

**Example**: `periodSeconds: 10` + `failureThreshold: 3` = 30s before restart

### successThreshold

**What**: How many consecutive successes needed to mark as healthy

```yaml
successThreshold: 1  # Usually 1 is fine
```

**Note**: Only configurable for readiness probe (liveness always 1)

---

## Best Practices

### 1. Always Use Both Probes

```yaml
# ✅ GOOD: Both probes defined
livenessProbe: { ... }
readinessProbe: { ... }

# ❌ BAD: Only liveness probe
livenessProbe: { ... }
# Pod will receive traffic immediately, even if not ready!
```

### 2. Make Probes Lightweight

```javascript
// ✅ GOOD: Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ❌ BAD: Heavy health check
app.get('/health', async (req, res) => {
  await db.query('SELECT * FROM users');  // Slow!
  await redis.ping();
  await checkExternalAPI();
  res.json({ status: 'ok' });
});
```

**Why**: Probes run frequently, heavy checks waste resources

### 3. Use Different Delays

```yaml
# ✅ GOOD: Readiness starts checking sooner
livenessProbe:
  initialDelaySeconds: 30   # Wait for app to fully start

readinessProbe:
  initialDelaySeconds: 10   # Start checking earlier
```

### 4. Set Appropriate Thresholds

```yaml
# ✅ GOOD: Allows temporary glitches
failureThreshold: 3   # 3 failures before restart
periodSeconds: 10     # = 30 seconds total

# ❌ BAD: Too aggressive
failureThreshold: 1   # Restart immediately
periodSeconds: 5      # = 5 seconds total
```

### 5. Don't Check External Dependencies in Liveness

```javascript
// ❌ BAD: Database down = container restart (won't help!)
app.get('/health', async (req, res) => {
  const dbOk = await checkDatabase();
  if (!dbOk) return res.status(500).send('unhealthy');
  res.send('ok');
});

// ✅ GOOD: Only check if app itself is alive
app.get('/health', (req, res) => {
  res.send('ok');  // Just check if server responds
});

// ✅ BETTER: Separate endpoint for readiness
app.get('/ready', async (req, res) => {
  const dbOk = await checkDatabase();  // Check dependencies
  if (!dbOk) return res.status(503).send('not ready');
  res.send('ready');
});
```

Then use different endpoints:
```yaml
livenessProbe:
  httpGet:
    path: /health  # Simple check

readinessProbe:
  httpGet:
    path: /ready   # Check dependencies
```

---

## Common Scenarios

### Scenario 1: App Startup

```
0s    Container starts
      ├─ App loading dependencies
      ├─ Connecting to database
      └─ Warming up caches

10s   Readiness probe starts checking
      ❌ Fails (still starting)

15s   Readiness check
      ❌ Fails (still not ready)

20s   App fully initialized
      ✅ Readiness passes
      → Added to Service endpoints
      → Starts receiving traffic

30s   Liveness probe starts checking
      ✅ Passes (app is alive)
```

### Scenario 2: Temporary Overload

```
Pod is running normally
├─ Liveness: ✅ Passing (app is alive)
└─ Readiness: ✅ Passing (receiving traffic)

Sudden traffic spike hits
├─ App becomes slow
├─ Readiness probe times out
└─ After 3 failures:
    ❌ Removed from Service
    → Traffic stops
    → App recovers

App recovered
├─ Readiness starts passing
└─ Added back to Service
    → Traffic resumes
```

**Key**: Container was NOT restarted! Just temporarily removed from service.

### Scenario 3: Memory Leak Causing Deadlock

```
App running normally
├─ Liveness: ✅ Passing
└─ Readiness: ✅ Passing

Memory leak grows
├─ App becomes unresponsive
├─ Readiness fails → Removed from service
└─ Liveness fails → After 3 attempts:
    🔄 Container RESTARTED
    → Fresh start with clean memory

New container starts
├─ Readiness passes → Added to service
└─ Liveness passes → Healthy
```

---

## Debugging Probes

### Check Probe Status

```bash
# Get pod details
kubectl describe pod <pod-name>

# Look for events like:
# Liveness probe failed: HTTP probe failed with statuscode: 500
# Readiness probe failed: Get http://10.1.0.43:3000/health: dial tcp 10.1.0.43:3000: connection refused
```

### Check Probe Configuration

```bash
# View liveness probe config
kubectl get pod <pod-name> -o jsonpath='{.spec.containers[0].livenessProbe}' | jq .

# View readiness probe config
kubectl get pod <pod-name> -o jsonpath='{.spec.containers[0].readinessProbe}' | jq .
```

### Test Health Endpoint Manually

```bash
# From inside the pod
kubectl exec <pod-name> -- wget -qO- http://localhost:3000/health

# Port-forward and test locally
kubectl port-forward <pod-name> 3000:3000
curl http://localhost:3000/health
```

### Common Issues

**Issue 1: CrashLoopBackOff**
```
Symptom: Pod keeps restarting
Cause: Liveness probe failing too quickly
Fix: Increase initialDelaySeconds or failureThreshold
```

**Issue 2: No Traffic Reaching Pod**
```
Symptom: Pod running but no requests
Cause: Readiness probe failing
Fix: Check readiness endpoint, verify dependencies
```

**Issue 3: Probe Timeout**
```
Symptom: "Readiness probe failed: timeout"
Cause: Endpoint takes too long to respond
Fix: Increase timeoutSeconds or optimize endpoint
```

---

## Summary

**Liveness Probe**:
- ❓ "Is the container alive?"
- 🔄 Action: Restart container
- 🎯 Use for: Deadlocks, crashes, unrecoverable errors
- ⏱️  Timing: Slower, less frequent

**Readiness Probe**:
- ❓ "Is it ready for traffic?"
- 🚫 Action: Remove from Service
- 🎯 Use for: Startup, overload, dependencies
- ⏱️  Timing: Faster, more frequent

**Key Takeaway**: Use BOTH probes for resilient applications!

