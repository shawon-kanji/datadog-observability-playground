# Load Balancing in Kubernetes: Complete Guide

This document explains who distributes traffic at each layer of the Kubernetes networking stack.

## Table of Contents

1. [The Confusion](#the-confusion)
2. [Local Setup (Docker Desktop)](#local-setup-docker-desktop)
3. [EKS with AWS Load Balancer Controller](#eks-with-aws-load-balancer-controller)
4. [EKS with Nginx Ingress](#eks-with-nginx-ingress)
5. [Summary Table](#summary-table)

---

## The Confusion

**Question**: Who actually distributes traffic across multiple pod replicas?

**Short Answer**: It depends on your setup! Different components do load balancing at different layers.

---

## Local Setup (Docker Desktop)

### Architecture

```
Browser: https://datadog-playground.local:30444/api/products
  ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: Nginx Ingress Controller (Pod)                        │
│ Job: Path-based routing                                         │
│ - /api/products → dd-app-api-service                           │
│ - /auth/login → user-auth-service                              │
│ Does NOT distribute across pod replicas!                        │
└─────────────────────────────────────────────────────────────────┘
  ↓
  Routes to: dd-app-api-service (ClusterIP: 10.99.216.157:3000)
  ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: Kubernetes Service + kube-proxy                       │
│ Job: Load balance across pod replicas ⭐                       │
│ Algorithm: Random selection (iptables mode)                     │
│                                                                 │
│ dd-app-api-service endpoints:                                  │
│   - 10.1.0.43:3000 (Pod 1)  ← 33% chance                       │
│   - 10.1.0.44:3000 (Pod 2)  ← 33% chance                       │
│   - 10.1.0.45:3000 (Pod 3)  ← 33% chance                       │
└─────────────────────────────────────────────────────────────────┘
  ↓
  Traffic goes to one pod (randomly selected)
```

### Who Does What?

| Component | Path Routing | Load Balancing Across Replicas |
|-----------|-------------|-------------------------------|
| **Nginx Ingress** | ✅ Yes | ❌ No |
| **Kubernetes Service** | ❌ No (just config) | ❌ No (just config) |
| **kube-proxy** | ❌ No | ✅ YES ⭐ |

### Example Flow:

```bash
# Request arrives
curl https://datadog-playground.local:30444/api/products

# Step 1: Nginx Ingress sees "/api" prefix
# Action: Routes to dd-app-api-service:3000

# Step 2: kube-proxy intercepts service request
# Action: Randomly selects one of 3 app pods
# Selected: 10.1.0.44:3000 (Pod 2)

# Step 3: Traffic forwarded to Pod 2
# Response returned back through same path
```

**Key Point**: Ingress does path routing, Service/kube-proxy does load balancing.

---

## EKS with AWS Load Balancer Controller

This is where it gets interesting! ALB does BOTH jobs.

### Architecture with `target-type: ip` (Default)

```
Browser: https://datadog-playground.com/api/products
  ↓
┌─────────────────────────────────────────────────────────────────┐
│ AWS Application Load Balancer (ALB)                            │
│                                                                  │
│ Job 1: Path-based routing (Ingress function)                   │
│ - /api/products → Target Group "app-service"                   │
│ - /auth/login → Target Group "auth-service"                    │
│                                                                  │
│ Job 2: Load balancing (Traffic distribution) ⭐                │
│ - Distributes across pod IPs in target group                   │
│ - Algorithm: Round-robin (default)                             │
│                                                                  │
│ Target Group "app-service":                                    │
│   - 10.1.0.43:3000 (Pod 1)  ← 33% of requests                  │
│   - 10.1.0.44:3000 (Pod 2)  ← 33% of requests                  │
│   - 10.1.0.45:3000 (Pod 3)  ← 33% of requests                  │
└─────────────────────────────────────────────────────────────────┘
  ↓
  Traffic goes DIRECTLY to pod (bypasses kube-proxy!)
  ↓
  Pod responds directly to ALB
```

### Who Does What?

| Component | Path Routing | Load Balancing Across Replicas |
|-----------|-------------|-------------------------------|
| **AWS ALB** | ✅ YES ⭐ | ✅ YES ⭐ |
| **Kubernetes Service** | ❌ No (just for discovery) | ❌ No (bypassed!) |
| **kube-proxy** | ❌ No | ❌ No (bypassed!) |

### Why is kube-proxy Bypassed?

The AWS Load Balancer Controller uses `target-type: ip`, which means:
- ALB registers **pod IPs directly** as targets
- Traffic goes **directly** from ALB → Pod
- Kubernetes Service is only used for **pod discovery**
- kube-proxy rules are **not used** for this traffic

### Example Flow:

```bash
# Request arrives
curl https://datadog-playground.com/api/products

# Step 1: ALB sees "/api" prefix
# Action: Routes to Target Group "app-service"

# Step 2: ALB does load balancing
# Target Group has 3 pod IPs registered
# ALB selects: 10.1.0.44:3000 (Pod 2) using round-robin

# Step 3: ALB forwards DIRECTLY to Pod 2 IP
# Response: Pod 2 → ALB → Browser

# kube-proxy is NOT involved!
```

### Visualizing Target Groups

```bash
# When you create this Ingress:
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    alb.ingress.kubernetes.io/target-type: ip
spec:
  rules:
  - host: datadog-playground.com
    http:
      paths:
      - path: /api
        backend:
          service:
            name: dd-app-api-service
            port:
              number: 3000

# AWS Load Balancer Controller creates:
# ALB: datadog-playground-alb
# ├─ Listener: 443 (HTTPS)
# ├─ Rule: /api/* → Target Group "k8s-default-ddappapi-abc123"
# └─ Target Group "k8s-default-ddappapi-abc123":
#    ├─ Target: 10.1.0.43:3000 (Pod 1) - healthy
#    ├─ Target: 10.1.0.44:3000 (Pod 2) - healthy
#    └─ Target: 10.1.0.45:3000 (Pod 3) - healthy
```

### How Does ALB Know About Pods?

```
Kubernetes API
  ↓ (watches)
AWS Load Balancer Controller (running in cluster)
  ↓ (reads Service endpoints)
Gets list of pod IPs: [10.1.0.43, 10.1.0.44, 10.1.0.45]
  ↓ (calls AWS API)
Registers pod IPs in ALB Target Group
  ↓
ALB load balances directly to pods
```

The controller continuously watches for pod changes and updates target groups automatically.

---

## EKS with Nginx Ingress

### Architecture

```
Browser: https://datadog-playground.com/api/products
  ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: AWS Network Load Balancer (NLB)                       │
│ Job: Load balance to nginx pods                                 │
│ - Distributes to nginx controller pods (usually just 1)        │
└─────────────────────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: Nginx Ingress Controller (Pod)                        │
│ Job: Path-based routing                                         │
│ - /api/products → dd-app-api-service                           │
│ Does NOT distribute across pod replicas!                        │
└─────────────────────────────────────────────────────────────────┘
  ↓
  Routes to: dd-app-api-service (ClusterIP)
  ↓
┌─────────────────────────────────────────────────────────────────┐
│ Layer 3: Kubernetes Service + kube-proxy                       │
│ Job: Load balance across pod replicas ⭐                       │
│ Algorithm: Random selection                                     │
│                                                                  │
│ dd-app-api-service endpoints:                                  │
│   - 10.1.0.43:3000 (Pod 1)                                     │
│   - 10.1.0.44:3000 (Pod 2)                                     │
│   - 10.1.0.45:3000 (Pod 3)                                     │
└─────────────────────────────────────────────────────────────────┘
  ↓
  Traffic goes to one pod (randomly selected by kube-proxy)
```

### Who Does What?

| Component | Path Routing | Load Balancing Across Replicas |
|-----------|-------------|-------------------------------|
| **AWS NLB** | ❌ No | ✅ Yes (to nginx pods) |
| **Nginx Ingress** | ✅ Yes | ❌ No |
| **Kubernetes Service** | ❌ No (just config) | ❌ No (just config) |
| **kube-proxy** | ❌ No | ✅ YES ⭐ |

This is the same as the local setup, just with an NLB in front!

---

## Summary Table

### Complete Comparison

| Setup | Path Routing | Pod Load Balancing | How It Works |
|-------|-------------|-------------------|--------------|
| **Local: Nginx Ingress** | Nginx Ingress | kube-proxy | Ingress → Service → kube-proxy → Pods |
| **EKS: AWS LB Controller** | ALB (rules) | ALB (target groups) | ALB directly routes to pod IPs |
| **EKS: Nginx Ingress** | Nginx Ingress | kube-proxy | NLB → Ingress → Service → kube-proxy → Pods |

### Key Differences

| Aspect | AWS LB Controller | Nginx Ingress |
|--------|------------------|---------------|
| **Layers** | 1 (ALB does everything) | 2 (Ingress + Service/kube-proxy) |
| **Path routing** | ALB listener rules | Nginx configuration |
| **Load balancing** | ALB target groups | kube-proxy iptables |
| **Traffic flow** | ALB → Pod (direct) | Ingress → Service → Pod |
| **kube-proxy used?** | ❌ No (bypassed) | ✅ Yes |
| **Service used?** | Only for discovery | For routing |
| **Pod IP management** | AWS LB Controller | kube-proxy |
| **Algorithm** | Round-robin (configurable) | Random (iptables) |
| **Performance** | Better (fewer hops) | Good (extra hop through service) |

---

## Deep Dive: target-type Comparison

AWS Load Balancer Controller supports two modes:

### Mode 1: target-type: ip (Default, Recommended)

```
ALB
  ↓ (directly to pod IPs)
Pod 1: 10.1.0.43
Pod 2: 10.1.0.44
Pod 3: 10.1.0.45
```

**Characteristics:**
- ALB registers pod IPs directly
- Traffic: ALB → Pod (1 hop)
- kube-proxy: NOT used
- Service: Only for pod discovery
- Performance: Best

### Mode 2: target-type: instance

```
ALB
  ↓ (to NodePort on EC2 instances)
EC2 Node 1 (NodePort 30000)
EC2 Node 2 (NodePort 30000)
  ↓ (kube-proxy distributes)
Pods: 10.1.0.43, 10.1.0.44, 10.1.0.45
```

**Characteristics:**
- ALB registers EC2 instance IPs
- Traffic: ALB → Node → kube-proxy → Pod (2 hops)
- kube-proxy: Used
- Service: Type NodePort required
- Performance: Good (extra hop)

---

## Practical Examples

### Example 1: Scaling App to 5 Replicas

**Local with Nginx Ingress:**
```bash
kubectl scale deployment dd-app-api --replicas=5

# What happens:
# 1. 5 pods created with IPs: 10.1.0.43-47
# 2. Service endpoints updated automatically
# 3. kube-proxy updates iptables rules
# 4. Traffic distributed 20% to each pod (random)
# 5. Nginx ingress sees no change (still routes to same service)
```

**EKS with AWS LB Controller:**
```bash
kubectl scale deployment dd-app-api --replicas=5

# What happens:
# 1. 5 pods created with IPs: 10.1.0.43-47
# 2. Service endpoints updated
# 3. AWS LB Controller detects change
# 4. Controller calls AWS API to add pod IPs to target group
# 5. ALB now has 5 targets, distributes 20% to each (round-robin)
# 6. kube-proxy rules NOT involved
```

### Example 2: Pod Health Check Failure

**Local with Nginx Ingress:**
```bash
# Pod 2 fails health check

# What happens:
# 1. Pod 2 marked as NotReady
# 2. Service automatically removes Pod 2 from endpoints
# 3. kube-proxy updates iptables (removes Pod 2)
# 4. Traffic now distributed to Pods 1, 3-5 (25% each)
```

**EKS with AWS LB Controller:**
```bash
# Pod 2 fails health check

# What happens:
# 1. ALB health check detects Pod 2 is unhealthy
# 2. ALB marks target 10.1.0.44:3000 as "unhealthy"
# 3. ALB stops sending traffic to Pod 2
# 4. Traffic distributed to Pods 1, 3-5 (25% each)
# 5. Controller also sees Pod NotReady, may deregister from target group
```

---

## Load Balancing Algorithms

### kube-proxy (iptables mode - default)

**Algorithm**: Random selection with equal probability

```
Request 1: Pod 3 (random)
Request 2: Pod 1 (random)
Request 3: Pod 3 (random - can repeat!)
Request 4: Pod 2 (random)
```

**Characteristics:**
- Simple and fast
- Not true round-robin
- Over time, evenly distributed
- No session affinity by default

### kube-proxy (IPVS mode)

**Algorithm**: Configurable (rr, lc, dh, sh, etc.)

```
# Round-robin (rr)
Request 1: Pod 1
Request 2: Pod 2
Request 3: Pod 3
Request 4: Pod 1  # cycles back
```

**Characteristics:**
- More algorithms available
- Better performance at scale
- Requires IPVS kernel modules

### AWS ALB

**Algorithm**: Round-robin (default) or Least Outstanding Requests

```
# Round-robin
Request 1: Pod 1
Request 2: Pod 2
Request 3: Pod 3
Request 4: Pod 1

# Least Outstanding Requests
# Routes to pod with fewest active connections
```

**Characteristics:**
- True round-robin
- Can enable sticky sessions (session affinity)
- Considers target health
- More sophisticated than kube-proxy

---

## Common Misconceptions

### ❌ Myth 1: "Service does load balancing"
**Reality**: Service is just configuration. kube-proxy does the actual load balancing.

### ❌ Myth 2: "Ingress does load balancing"
**Reality**: Depends! Nginx Ingress does NOT. AWS ALB Ingress DOES.

### ❌ Myth 3: "ClusterIP services don't load balance"
**Reality**: All service types (ClusterIP, NodePort, LoadBalancer) use the same load balancing mechanism via kube-proxy.

### ❌ Myth 4: "ALB only does path routing"
**Reality**: ALB does BOTH path routing AND load balancing across pod replicas.

### ❌ Myth 5: "You need kube-proxy for load balancing in EKS"
**Reality**: With AWS Load Balancer Controller + target-type:ip, kube-proxy is bypassed for ingress traffic.

---

## Debugging Load Balancing

### Check Service Endpoints

```bash
# See which pod IPs are registered
kubectl get endpoints dd-app-api-service

# Example output:
# NAME                 ENDPOINTS
# dd-app-api-service   10.1.0.43:3000,10.1.0.44:3000,10.1.0.45:3000
```

### Check kube-proxy Rules (iptables)

```bash
# SSH to node and check iptables
sudo iptables-save | grep dd-app-api-service

# You'll see rules distributing traffic to pod IPs
```

### Check ALB Target Groups (EKS)

```bash
# Get target group ARN
ALB_ARN=$(aws elbv2 describe-load-balancers --query "LoadBalancers[?contains(LoadBalancerName, 'k8s')].LoadBalancerArn" --output text)

# Get target groups
aws elbv2 describe-target-groups --load-balancer-arn $ALB_ARN

# Check target health
aws elbv2 describe-target-health --target-group-arn <TG_ARN>
```

### Test Load Distribution

```bash
# Make 10 requests and see which pods respond
for i in {1..10}; do
  curl -s https://your-domain.com/api/health | jq -r '.pod_name'
done

# Example output:
# dd-app-api-689b56d449-abc12
# dd-app-api-689b56d449-def34
# dd-app-api-689b56d449-abc12
# dd-app-api-689b56d449-ghi56
# ...
```

---

## Summary

**Who distributes traffic across pod replicas?**

| Setup | Answer |
|-------|--------|
| Local Kubernetes | **kube-proxy** |
| EKS + AWS LB Controller | **AWS ALB** (directly to pods) |
| EKS + Nginx Ingress | **kube-proxy** (same as local) |

**Key Takeaways:**
1. Services are configuration, not load balancers
2. kube-proxy is the default load balancer in Kubernetes
3. AWS ALB can bypass kube-proxy and load balance directly to pods
4. Ingress controllers do path routing, but may or may not do load balancing
5. The architecture affects performance and complexity

