# HPA Architecture: How It Connects to Metrics

This document explains how the Horizontal Pod Autoscaler (HPA) discovers and queries metrics.

## Table of Contents

1. [The Question](#the-question)
2. [API Aggregation Layer](#api-aggregation-layer)
3. [How metrics-server Registers](#how-metrics-server-registers)
4. [Complete Request Flow](#complete-request-flow)
5. [Three Types of Metrics APIs](#three-types-of-metrics-apis)
6. [Debugging](#debugging)

---

## The Question

**"How does HPA know it has to connect to metrics-server?"**

**Short Answer**: It doesn't directly. HPA talks to the Kubernetes API server, which routes metrics requests to metrics-server via the **API Aggregation Layer**.

---

## API Aggregation Layer

Kubernetes API server acts as a **unified API gateway** that aggregates multiple APIs:

```
┌──────────────────────────────────────────────────────────────┐
│                    Kubernetes API Server                      │
│                   (API Aggregation Layer)                     │
│                                                               │
│  Built-in APIs:                                              │
│  ├─ /api/v1/pods              → Core API (built-in)         │
│  ├─ /apis/apps/v1/deployments → Apps API (built-in)         │
│  └─ /apis/batch/v1/jobs       → Batch API (built-in)        │
│                                                               │
│  Extension APIs (via APIService):                            │
│  ├─ /apis/metrics.k8s.io/v1beta1/*                          │
│  │     → metrics-server.kube-system (Resource metrics)       │
│  ├─ /apis/custom.metrics.k8s.io/v1beta1/*                   │
│  │     → prometheus-adapter (Custom metrics)                 │
│  └─ /apis/external.metrics.k8s.io/v1beta1/*                 │
│        → datadog-cluster-agent (External metrics)            │
└──────────────────────────────────────────────────────────────┘
         ↑                    ↓
    (queries via)        (proxies to)
         ↑                    ↓
┌─────────────────┐   ┌──────────────────┐
│  HPA Controller │   │  Metrics Server  │
│                 │   │  (or adapter)    │
└─────────────────┘   └──────────────────┘
```

**Key Point**: HPA doesn't need to know WHERE metrics-server is. It just queries the standard API path, and the API server routes it automatically.

---

## How metrics-server Registers

When you install metrics-server, it creates an **APIService** resource that registers itself with the API server.

### Installation Creates:

1. **Deployment**: The actual metrics-server pods
2. **Service**: ClusterIP service to reach the pods
3. **APIService**: Registration with API aggregation layer

### APIService Definition

```yaml
apiVersion: apiregistration.k8s.io/v1
kind: APIService
metadata:
  name: v1beta1.metrics.k8s.io
  labels:
    k8s-app: metrics-server
spec:
  service:
    name: metrics-server       # Service to proxy to
    namespace: kube-system      # In kube-system namespace
    port: 443                   # HTTPS port
  group: metrics.k8s.io         # API group
  version: v1beta1              # API version
  insecureSkipTLSVerify: true   # For Docker Desktop
  groupPriorityMinimum: 100
  versionPriority: 100
```

This tells the API server:

> "When someone requests `/apis/metrics.k8s.io/v1beta1/*`, proxy the request to `https://metrics-server.kube-system.svc:443`"

### Verify APIService Registration:

```bash
# Check if metrics API is registered
kubectl get apiservice v1beta1.metrics.k8s.io

# Get details
kubectl get apiservice v1beta1.metrics.k8s.io -o yaml

# Check status
kubectl get apiservice v1beta1.metrics.k8s.io -o jsonpath='{.status.conditions}'
```

**Expected output when working:**
```
NAME                     SERVICE                      AVAILABLE   AGE
v1beta1.metrics.k8s.io   kube-system/metrics-server   True        5m
```

---

## Complete Request Flow

### Scenario: HPA Needs Current CPU Usage

```
┌──────────────────────────────────────────────────────────────┐
│ Step 1: HPA Controller (runs in kube-controller-manager)    │
└──────────────────────────────────────────────────────────────┘
    |
    | Every 15 seconds, HPA controller evaluates:
    | "Do I need to scale dd-app-api deployment?"
    |
    v
┌──────────────────────────────────────────────────────────────┐
│ Step 2: Query Metrics API                                    │
│ GET https://kubernetes.default.svc/apis/metrics.k8s.io/     │
│     v1beta1/namespaces/default/pods                          │
│ ?labelSelector=app=dd-app-api                                │
└──────────────────────────────────────────────────────────────┘
    |
    | Request reaches Kubernetes API server
    |
    v
┌──────────────────────────────────────────────────────────────┐
│ Step 3: API Server Routing Logic                            │
│                                                               │
│ 1. Parse request path: /apis/metrics.k8s.io/v1beta1/...    │
│ 2. Lookup APIService: v1beta1.metrics.k8s.io               │
│ 3. Found registration:                                       │
│    - Service: metrics-server                                 │
│    - Namespace: kube-system                                  │
│    - Port: 443                                               │
│ 4. Proxy request to: https://metrics-server.kube-system:443 │
└──────────────────────────────────────────────────────────────┘
    |
    | API server proxies the request
    |
    v
┌──────────────────────────────────────────────────────────────┐
│ Step 4: Metrics Server Processing                           │
│                                                               │
│ 1. Receives request from API server                          │
│ 2. For each pod matching label app=dd-app-api:             │
│    - Query kubelet API on the pod's node                    │
│    - Get CPU/memory usage from cAdvisor                     │
│ 3. Aggregate metrics                                         │
│ 4. Return JSON response                                      │
└──────────────────────────────────────────────────────────────┘
    |
    | Response: {
    |   "items": [
    |     {
    |       "metadata": {"name": "dd-app-api-689b56d449-vgt9t"},
    |       "containers": [{
    |         "name": "dd-app-api",
    |         "usage": {
    |           "cpu": "50m",
    |           "memory": "128Mi"
    |         }
    |       }]
    |     }
    |   ]
    | }
    |
    v
┌──────────────────────────────────────────────────────────────┐
│ Step 5: API Server Forwards Response to HPA                 │
└──────────────────────────────────────────────────────────────┘
    |
    v
┌──────────────────────────────────────────────────────────────┐
│ Step 6: HPA Controller Makes Scaling Decision               │
│                                                               │
│ 1. Current CPU: 50m                                          │
│ 2. CPU request: 100m (from deployment spec)                 │
│ 3. Utilization: 50m / 100m = 50%                            │
│ 4. Target: 70%                                               │
│ 5. Decision: Current < Target → No scaling needed           │
└──────────────────────────────────────────────────────────────┘
```

### The Key Insight:

**HPA never directly connects to metrics-server!**

- HPA only knows the standard API path: `/apis/metrics.k8s.io/v1beta1/*`
- API server handles routing via APIService registration
- This is the same pattern for ALL extension APIs

---

## Three Types of Metrics APIs

Kubernetes supports three types of metrics via API aggregation:

### 1. Resource Metrics API (metrics.k8s.io)

**Provider**: metrics-server

**What**: Pod and node CPU/memory usage

**Used by**: HPA with CPU/memory targets, `kubectl top`

**API Path**: `/apis/metrics.k8s.io/v1beta1/`

**HPA Example**:
```yaml
metrics:
- type: Resource
  resource:
    name: cpu
    target:
      type: Utilization
      averageUtilization: 70
```

**Registration**:
```yaml
apiVersion: apiregistration.k8s.io/v1
kind: APIService
metadata:
  name: v1beta1.metrics.k8s.io
spec:
  service:
    name: metrics-server
    namespace: kube-system
```

### 2. Custom Metrics API (custom.metrics.k8s.io)

**Provider**: prometheus-adapter, Datadog Cluster Agent, etc.

**What**: Application-specific metrics (requests/sec, queue depth, etc.)

**Used by**: HPA with custom metrics from Prometheus/Datadog

**API Path**: `/apis/custom.metrics.k8s.io/v1beta1/`

**HPA Example**:
```yaml
metrics:
- type: Pods
  pods:
    metric:
      name: http_requests_per_second
    target:
      type: AverageValue
      averageValue: "1000"
```

**Registration**:
```yaml
apiVersion: apiregistration.k8s.io/v1
kind: APIService
metadata:
  name: v1beta1.custom.metrics.k8s.io
spec:
  service:
    name: prometheus-adapter
    namespace: monitoring
```

### 3. External Metrics API (external.metrics.k8s.io)

**Provider**: Datadog Cluster Agent, CloudWatch adapter, etc.

**What**: Metrics from external systems (AWS SQS queue length, Datadog APM, etc.)

**Used by**: HPA scaling based on external signals

**API Path**: `/apis/external.metrics.k8s.io/v1beta1/`

**HPA Example**:
```yaml
metrics:
- type: External
  external:
    metric:
      name: sqs.queue.length
      selector:
        matchLabels:
          queue: orders
    target:
      type: Value
      value: "30"
```

**Registration**:
```yaml
apiVersion: apiregistration.k8s.io/v1
kind: APIService
metadata:
  name: v1beta1.external.metrics.k8s.io
spec:
  service:
    name: datadog-cluster-agent-metrics-server
    namespace: default
```

---

## Comparison Table

| Metric Type | API Group | Provider Example | Use Case | HPA Type |
|------------|-----------|------------------|----------|----------|
| **Resource** | metrics.k8s.io | metrics-server | CPU, Memory | `type: Resource` |
| **Custom** | custom.metrics.k8s.io | prometheus-adapter | App metrics per pod | `type: Pods` |
| **External** | external.metrics.k8s.io | datadog-cluster-agent | External system metrics | `type: External` |

---

## Debugging

### Check if Metrics API is Available

```bash
# List all APIServices
kubectl get apiservice

# Check metrics API specifically
kubectl get apiservice v1beta1.metrics.k8s.io

# Check status and availability
kubectl get apiservice v1beta1.metrics.k8s.io -o jsonpath='{.status.conditions[?(@.type=="Available")].status}'
# Should return: True
```

### Test Direct API Access

```bash
# Query metrics API directly (same as HPA does)
kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes | jq .

# Get pod metrics
kubectl get --raw /apis/metrics.k8s.io/v1beta1/namespaces/default/pods | jq .

# Get specific pod metrics
kubectl get --raw /apis/metrics.k8s.io/v1beta1/namespaces/default/pods/dd-app-api-689b56d449-vgt9t | jq .
```

### Check HPA Can Query Metrics

```bash
# Get HPA status
kubectl get hpa dd-app-api-hpa

# Should show:
# NAME              REFERENCE               TARGETS   MINPODS   MAXPODS   REPLICAS
# dd-app-api-hpa    Deployment/dd-app-api   50%/70%   2         10        2
#                                            ↑ If this shows <unknown>, metrics are not available

# Describe HPA for detailed status
kubectl describe hpa dd-app-api-hpa

# Look for events showing metric queries
```

### Check metrics-server Logs

```bash
# Get metrics-server logs
kubectl logs -n kube-system deployment/metrics-server

# Common errors:
# - "Unable to authenticate": TLS verification issue
# - "no metrics known for pod": Pod doesn't have resource requests
# - "unable to fetch pod metrics": Kubelet connection issue
```

### Verify APIService Backend is Healthy

```bash
# Check if metrics-server service exists
kubectl get svc -n kube-system metrics-server

# Check if metrics-server pods are running
kubectl get pods -n kube-system -l k8s-app=metrics-server

# Test connectivity to metrics-server
kubectl run test-metrics --rm -it --image=curlimages/curl --restart=Never -- \
  curl -k https://metrics-server.kube-system.svc/metrics
```

---

## Behind the Scenes: How API Aggregation Works

### Kubernetes API Server Configuration

The API server has API aggregation enabled by default (since Kubernetes 1.7).

**API Server Flags** (configured automatically):
```
--enable-aggregator-routing=true
--requestheader-client-ca-file=/etc/kubernetes/pki/front-proxy-ca.crt
--proxy-client-cert-file=/etc/kubernetes/pki/front-proxy-client.crt
--proxy-client-key-file=/etc/kubernetes/pki/front-proxy-client.key
```

These allow the API server to:
1. Accept APIService registrations
2. Proxy requests to extension APIs
3. Handle TLS authentication with extension API servers

### How Routing Works

When a request comes in:

```go
// Simplified API server routing logic

func handleRequest(request *Request) {
    path := request.URL.Path

    // Check if path matches an APIService
    if strings.HasPrefix(path, "/apis/") {
        apiService := lookupAPIService(path)

        if apiService != nil && apiService.Service != nil {
            // Proxy to the service
            targetURL := fmt.Sprintf("https://%s.%s.svc:%d%s",
                apiService.Service.Name,
                apiService.Service.Namespace,
                apiService.Service.Port,
                request.URL.Path)

            return proxy(targetURL, request)
        }
    }

    // Otherwise, handle as built-in API
    return handleBuiltInAPI(request)
}
```

### Service Discovery

The API server uses Kubernetes service DNS to reach extension APIs:

```
API Server wants to reach: metrics-server in kube-system
  ↓
DNS lookup: metrics-server.kube-system.svc.cluster.local
  ↓
Resolves to: ClusterIP (e.g., 10.96.1.123)
  ↓
Connects to: https://10.96.1.123:443
  ↓
Reaches: metrics-server pod
```

This is standard Kubernetes service networking!

---

## Summary

**How does HPA know to connect to metrics-server?**

It doesn't directly! The architecture works like this:

1. ✅ **HPA** queries standard API path: `/apis/metrics.k8s.io/v1beta1/*`
2. ✅ **API Server** checks APIService registry
3. ✅ **APIService** registration points to `metrics-server.kube-system`
4. ✅ **API Server** proxies request to metrics-server
5. ✅ **Metrics Server** responds with pod/node metrics
6. ✅ **API Server** forwards response to HPA
7. ✅ **HPA** makes scaling decision

**Key Takeaways:**
- HPA is decoupled from metrics provider
- API aggregation enables pluggable metrics sources
- Same pattern works for Prometheus, Datadog, CloudWatch adapters
- Extension APIs look like built-in APIs to clients
- This is why you can swap metrics providers without changing HPA configuration (just change the APIService registration)

