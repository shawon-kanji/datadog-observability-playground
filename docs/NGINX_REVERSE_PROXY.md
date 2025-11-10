# Nginx Reverse Proxy Architecture for EKS Deployment

## Table of Contents
- [Overview](#overview)
- [Architecture Diagram](#architecture-diagram)
- [Request Flow](#request-flow)
- [Network Topology](#network-topology)
- [Configuration Details](#configuration-details)
- [Benefits](#benefits)
- [Comparison: With vs Without Reverse Proxy](#comparison-with-vs-without-reverse-proxy)
- [Troubleshooting](#troubleshooting)

---

## Overview

This document explains how the nginx reverse proxy architecture works in our EKS deployment. The frontend nginx container acts as a **gateway/router** that:

1. Serves static React files to users
2. Proxies API requests to backend microservices
3. Eliminates CORS issues
4. Reduces costs (single LoadBalancer)
5. Improves security (backend services not exposed)

---

## Architecture Diagram

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Internet                                │
│                    (Public Network)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS/HTTP
                         ▼
        ┌────────────────────────────────────┐
        │   AWS Application Load Balancer    │
        │   (Single Entry Point)             │
        │   a7149dee...elb.amazonaws.com     │
        └────────────┬───────────────────────┘
                     │
                     │ Forwards to
                     ▼
┌────────────────────────────────────────────────────────────┐
│              Kubernetes Cluster (EKS)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Frontend Pod (Nginx + React)                        │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Nginx (Port 80)                               │  │  │
│  │  │  ┌──────────────┬──────────────┬────────────┐  │  │  │
│  │  │  │ Static Files │ /api Proxy   │ /auth Proxy│  │  │  │
│  │  │  │ (React App)  │ → App Service│ → Auth Svc │  │  │  │
│  │  │  └──────────────┴──────────────┴────────────┘  │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └────────────┬─────────────────┬───────────────────────┘  │
│               │                 │                           │
│  ┌────────────▼──────┐  ┌───────▼──────────┐               │
│  │ dd-app-api-service│  │ user-auth-service│               │
│  │ (ClusterIP)       │  │ (ClusterIP)      │               │
│  │ Port: 3000        │  │ Port: 3002       │               │
│  └────────┬──────────┘  └────────┬─────────┘               │
│           │                      │                          │
│  ┌────────▼──────────┐  ┌────────▼──────────┐              │
│  │ Product Service   │  │ User Service      │              │
│  │ Pod(s)            │  │ Pod(s)            │              │
│  └───────────────────┘  └───────────────────┘              │
│                                                             │
│  ┌──────────────────────────────────────────┐              │
│  │ order-service (ClusterIP)                │              │
│  │ mongo-service (ClusterIP)                │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## Request Flow

### Detailed Step-by-Step Flow

#### Step 1: User Visits Frontend

```
User Browser
    │
    │ GET http://a7149dee...elb.amazonaws.com/
    ▼
AWS LoadBalancer
    │
    │ Forwards to Frontend Pod
    ▼
Frontend Pod (Nginx)
    │
    │ location / { try_files $uri /index.html; }
    ▼
Serves /usr/share/nginx/html/index.html
    │
    │ Response: HTML + JavaScript (React App)
    ▼
User Browser (React app now running locally)
```

**What happens:**
- LoadBalancer forwards request to frontend pod
- Nginx serves static React files
- Browser downloads and executes JavaScript
- React app is now running **in the browser**

---

#### Step 2: User Clicks "View Products" (API Call)

**Browser executes JavaScript:**

```javascript
// Code running in browser
import { apiClient } from './api/client';

// apiClient has baseURL = '/'
apiClient.get('/api/products')

// Browser computes full URL:
// Current page: http://a7149dee...elb.amazonaws.com/
// Relative path: /api/products
// Final URL: http://a7149dee...elb.amazonaws.com/api/products
```

**HTTP Request:**

```
Browser
    │
    │ GET /api/products HTTP/1.1
    │ Host: a7149dee...elb.amazonaws.com
    │ Origin: http://a7149dee...elb.amazonaws.com
    ▼
AWS LoadBalancer
    │
    │ Forwards to Frontend Pod
    ▼
Frontend Pod (Nginx on port 80)
```

**Key Point**: Browser thinks it's making a request to the **same server** it got the HTML from. This means **NO CORS issues**!

---

#### Step 3: Nginx Processes Request

```nginx
# Nginx receives: GET /api/products

# Check location blocks in order:

location /api {
    # Pattern matches! Execute this block

    # Step 3a: Rewrite URL
    rewrite ^/api/(.*) /$1 break;
    #       ^/api/(.*) = pattern to match
    #       /api/products matches
    #       Capture group: "products"
    #       Result: /products

    # Step 3b: Proxy to backend
    proxy_pass http://dd-app-api-service:3000;
    # Makes NEW request to: http://dd-app-api-service:3000/products
}
```

**Visual breakdown of rewrite:**

```
Input:    /api/products
          ─┬── ────┬────
           │      │
Pattern:   │      └─ Captured by (.*)
           │         Stored as $1
           └─ Matches ^/api/

Rewrite:  /$1
Result:   /products
```

---

#### Step 4: Internal Request to Backend Service

**Nginx makes a NEW HTTP request (server-to-server) INSIDE Kubernetes:**

```
Frontend Pod (Nginx)
    │
    │ Internal Kubernetes Network Request
    │ GET /products HTTP/1.1
    │ Host: dd-app-api-service:3000
    │ X-Real-IP: <user's actual IP>
    │ X-Forwarded-For: <user's IP>
    ▼
Kubernetes DNS (CoreDNS)
    │
    │ Resolve: dd-app-api-service
    │ Returns: 10.100.200.123 (ClusterIP)
    ▼
dd-app-api-service (ClusterIP)
    │
    │ Load balances to pod(s) with label: app=dd-app-api
    ▼
Product Service Pod (Express/Node.js)
    │
    │ Route: app.get('/products', ...)
    │ Query MongoDB
    │ Generate response
    ▼
Response: HTTP 200 OK
Content-Type: application/json
Body: [{"id": 1, "name": "Product A"}, ...]
```

**Important points:**
- This is an **internal cluster network** request
- Backend service is **ClusterIP** (not exposed to internet)
- Kubernetes DNS resolves service name to IP
- Fast communication (no internet hops)

---

#### Step 5: Response Flow Back to Browser

```
Product Service Pod
    │
    │ HTTP/1.1 200 OK
    │ [{"id": 1, "name": "Product A"}, ...]
    ▼
dd-app-api-service (ClusterIP)
    │
    │ Routes response back to nginx
    ▼
Frontend Pod (Nginx)
    │
    │ Forwards response with headers
    ▼
AWS LoadBalancer
    │
    │ Forwards to browser
    ▼
User Browser
    │
    │ Receives JSON response
    │ From: http://a7149dee...elb.amazonaws.com/api/products
    │ (Same origin as the page - no CORS!)
    ▼
React updates UI with product data
```

---

## Network Topology

### Two Separate Networks

#### 1. Public Network (Internet)

```
┌──────────────────────────────────────────────────┐
│  Internet                                        │
│                                                  │
│  User's Browser (203.0.113.45)                   │
│         │                                        │
│         │ HTTP Request                           │
│         ▼                                        │
│  AWS LoadBalancer (Public IP)                    │
│  a7149dee...elb.amazonaws.com                    │
│         │                                        │
│         │ Forwards to                            │
│         ▼                                        │
│  EKS Worker Node (Public/Private IP)             │
│         │                                        │
│         │ Routes to                              │
│         ▼                                        │
│  Frontend Pod (10.0.1.50:80)                     │
└──────────────────────────────────────────────────┘
```

#### 2. Kubernetes Internal Network (Private)

```
┌──────────────────────────────────────────────────┐
│  Kubernetes Cluster Network                      │
│  (Pod-to-Pod communication)                      │
│                                                  │
│  Frontend Pod (10.0.1.50)                        │
│         │                                        │
│         │ Internal HTTP Request                  │
│         ▼                                        │
│  Kubernetes Service (ClusterIP)                  │
│  dd-app-api-service: 10.100.200.123:3000         │
│         │                                        │
│         │ Load balances to                       │
│         ▼                                        │
│  ┌──────────────┬──────────────┐                 │
│  │ App Pod 1    │ App Pod 2    │                 │
│  │ 10.0.1.51    │ 10.0.1.52    │                 │
│  └──────────────┴──────────────┘                 │
│                                                  │
│  Other Services (ClusterIP):                     │
│  - user-auth-service: 10.100.200.124:3002        │
│  - order-service: 10.100.200.125:3001            │
│  - mongo-service: 10.100.200.126:27017           │
└──────────────────────────────────────────────────┘
```

### Service Types and Accessibility

| Service | Type | Internal IP | External Access | Purpose |
|---------|------|-------------|-----------------|---------|
| frontend-service | LoadBalancer | 10.100.200.120 | ✅ Yes (via ELB) | User interface |
| dd-app-api-service | ClusterIP | 10.100.200.123 | ❌ No | Product API (internal only) |
| user-auth-service | ClusterIP | 10.100.200.124 | ❌ No | Authentication (internal only) |
| order-service | ClusterIP | 10.100.200.125 | ❌ No | Orders (internal only) |
| mongo-service | ClusterIP | 10.100.200.126 | ❌ No | Database (internal only) |

---

## Configuration Details

### Frontend Dockerfile (Dockerfile.eks)

```dockerfile
# Multi-stage build for EKS deployment
FROM node:20-alpine AS builder

RUN corepack enable
WORKDIR /app

COPY package.json ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY . .

# Key configuration: Use relative paths
# Frontend code already includes /api and /auth prefixes
ARG VITE_API_BASE_URL=/
ARG VITE_AUTH_BASE_URL=/
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AUTH_BASE_URL=$VITE_AUTH_BASE_URL

RUN pnpm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.eks.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Why `VITE_API_BASE_URL=/`?**

Frontend code has paths like:
```javascript
apiClient.get('/api/products')  // Already includes /api prefix
```

So we need:
```
baseURL: '/'
+ path: '/api/products'
= Final URL: '/api/products'  ✓ Correct
```

If we used `baseURL: '/api'`:
```
baseURL: '/api'
+ path: '/api/products'
= Final URL: '/api/api/products'  ❌ Wrong (double /api)
```

---

### Nginx Configuration (nginx.eks.conf)

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Performance optimization
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1000;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # ===========================================
    # API Reverse Proxy
    # ===========================================
    location /api {
        # Remove /api prefix before forwarding
        rewrite ^/api/(.*) /$1 break;

        # Proxy to product service (ClusterIP)
        proxy_pass http://dd-app-api-service:3000;

        # Forward headers
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # ===========================================
    # Auth Service Reverse Proxy
    # ===========================================
    location /auth {
        # Remove /auth prefix before forwarding
        rewrite ^/auth/(.*) /$1 break;

        # Proxy to auth service (ClusterIP)
        proxy_pass http://user-auth-service:3002;

        # Forward headers
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # ===========================================
    # Serve Static Files (React App)
    # ===========================================
    location / {
        # React Router support - all routes fallback to index.html
        try_files $uri $uri/ /index.html;

        # Cache static assets aggressively
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # ===========================================
    # Health Check (for Kubernetes probes)
    # ===========================================
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### Nginx Rewrite Examples

**Example 1: Product API**
```
Input:    GET /api/products
Pattern:  ^/api/(.*)
Matches:  Yes
Capture:  "products" → stored in $1
Rewrite:  /$1 = /products
Result:   GET http://dd-app-api-service:3000/products
```

**Example 2: Specific Product**
```
Input:    GET /api/products/123
Pattern:  ^/api/(.*)
Matches:  Yes
Capture:  "products/123" → stored in $1
Rewrite:  /$1 = /products/123
Result:   GET http://dd-app-api-service:3000/products/123
```

**Example 3: Login**
```
Input:    POST /auth/login
Pattern:  ^/auth/(.*)
Matches:  Yes
Capture:  "login" → stored in $1
Rewrite:  /$1 = /login
Result:   POST http://user-auth-service:3002/login
```

---

## Benefits

### 1. No CORS Issues ✅

**Without Reverse Proxy:**
```
Frontend: http://frontend-lb.amazonaws.com
API:      http://api-lb.amazonaws.com:3000

Browser: "Cross-Origin Request Blocked!"
```

**With Reverse Proxy:**
```
Frontend: http://frontend-lb.amazonaws.com
API:      http://frontend-lb.amazonaws.com/api/products

Browser: "Same origin - allowed!"
```

All requests appear to come from the same domain!

---

### 2. Cost Savings 💰

**Without Reverse Proxy:**
- Frontend LoadBalancer: ~$18/month
- App API LoadBalancer: ~$18/month
- Auth LoadBalancer: ~$18/month
- **Total: ~$54/month**

**With Reverse Proxy:**
- Frontend LoadBalancer: ~$18/month
- Backend services: ClusterIP (free)
- **Total: ~$18/month**

**Savings: ~$36/month (66% reduction)**

---

### 3. Security 🔒

**Backend services are NOT exposed to the internet:**
- dd-app-api-service: ClusterIP (internal only)
- user-auth-service: ClusterIP (internal only)
- order-service: ClusterIP (internal only)
- mongo-service: ClusterIP (internal only)

**Attack surface:**
- Without proxy: 4 public endpoints
- With proxy: 1 public endpoint (frontend only)

---

### 4. Simplified Frontend Configuration 🎯

**Frontend only needs to know about relative paths:**
```javascript
// Simple, clean code
fetch('/api/products')
fetch('/auth/login')
fetch('/api/orders')
```

**No environment-specific URLs:**
- ❌ No `REACT_APP_API_URL=http://prod-api.company.com`
- ❌ No `REACT_APP_AUTH_URL=http://auth.company.com`
- ✅ Just relative paths that work everywhere

---

### 5. Flexibility & Maintainability 🔧

**Change backend URLs without rebuilding frontend:**
- Move services to different namespaces
- Scale services independently
- Replace service implementations
- Frontend doesn't need to know!

---

## Comparison: With vs Without Reverse Proxy

### Architecture Without Reverse Proxy

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
   ┌───┴────────────────────────────┐
   │                                │
   ▼                                ▼
┌──────────────┐           ┌─────────────────┐
│ Frontend LB  │           │   API LB        │
│ (ELB)        │           │   (ELB)         │
└──────┬───────┘           └────────┬────────┘
       │                            │
       ▼                            ▼
┌──────────────┐           ┌─────────────────┐
│ Frontend Pod │           │ App API Pod     │
└──────────────┘           └─────────────────┘

Problems:
❌ CORS errors (different origins)
❌ Multiple LoadBalancers ($$$)
❌ Backend exposed to internet (security)
❌ Complex frontend configuration
```

### Architecture With Reverse Proxy (Current)

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ Single entry point
       ▼
┌──────────────┐
│ Frontend LB  │
│ (ELB)        │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Frontend Pod (Nginx) │
│  ┌────────────────┐  │
│  │ Static Files   │  │
│  │ /api → App Svc │  │
│  │ /auth → Auth   │  │
│  └────────────────┘  │
└──────┬───────────────┘
       │
   ┌───┴────────────┐
   │                │
   ▼                ▼
┌──────────┐   ┌──────────┐
│ App Pod  │   │ Auth Pod │
│(ClusterIP│   │(ClusterIP│
└──────────┘   └──────────┘

Benefits:
✅ No CORS (same origin)
✅ Single LoadBalancer (cost savings)
✅ Backend hidden (security)
✅ Simple frontend config
```

---

## Troubleshooting

### Issue 1: 502 Bad Gateway

**Symptom:**
```
Browser receives: 502 Bad Gateway
Nginx logs: upstream not found
```

**Cause:** Backend service not running or wrong service name

**Solution:**
```bash
# Check if services exist
kubectl get svc

# Check if pods are running
kubectl get pods

# Check nginx can resolve service name
kubectl exec -it deployment/frontend -- nslookup dd-app-api-service
```

---

### Issue 2: 404 Not Found

**Symptom:**
```
GET /api/products → 404 Not Found
Backend logs: No route for GET /api/products
```

**Cause:** Rewrite rule not working, backend receives `/api/products` instead of `/products`

**Solution:** Check nginx rewrite configuration:
```nginx
# Should have:
rewrite ^/api/(.*) /$1 break;

# If missing, backend gets full path with /api prefix
```

---

### Issue 3: CORS Errors (Still)

**Symptom:**
```
Browser console: Access to fetch at 'http://...' has been blocked by CORS policy
```

**Cause:** Frontend code is using absolute URLs instead of relative paths

**Solution:** Check frontend code:
```javascript
// ❌ Wrong - absolute URL
fetch('http://api-service:3000/products')

// ✅ Correct - relative path
fetch('/api/products')
```

---

### Issue 4: Timeout Errors

**Symptom:**
```
504 Gateway Timeout
Nginx logs: upstream timed out
```

**Cause:** Backend processing takes > 60 seconds

**Solution:** Increase timeouts in nginx config:
```nginx
proxy_connect_timeout 120s;
proxy_send_timeout 120s;
proxy_read_timeout 120s;
```

---

### Issue 5: Wrong URLs (Double /api/api)

**Symptom:**
```
Browser calls: /api/api/products
Backend receives: /api/products (rewrite strips one /api)
Backend route: GET /products (doesn't match)
```

**Cause:** `VITE_API_BASE_URL=/api` but frontend code already has `/api` prefix

**Solution:** Set in Dockerfile:
```dockerfile
ARG VITE_API_BASE_URL=/
# Not /api
```

Frontend code:
```javascript
// Code has:
apiClient.get('/api/products')

// With baseURL='/', becomes:
// '/' + '/api/products' = '/api/products' ✓
```

---

### Debugging Commands

```bash
# Check nginx config is correct
kubectl exec -it deployment/frontend -- cat /etc/nginx/conf.d/default.conf

# View nginx logs
kubectl logs deployment/frontend -f

# Check service endpoints
kubectl get endpoints dd-app-api-service

# Test from inside frontend pod
kubectl exec -it deployment/frontend -- wget -O- http://dd-app-api-service:3000/health

# Check DNS resolution
kubectl exec -it deployment/frontend -- nslookup dd-app-api-service

# View all services and types
kubectl get svc -o wide
```

---

## Summary

The nginx reverse proxy architecture provides:

1. **Single entry point**: One LoadBalancer for all traffic
2. **No CORS issues**: All requests from same origin
3. **Security**: Backend services hidden from internet
4. **Cost savings**: Only one LoadBalancer needed
5. **Simplicity**: Frontend uses relative paths
6. **Flexibility**: Easy to change backend URLs

This is the **industry standard pattern** for production microservices deployments! 🚀
