# Docker desktop Kubernetes Ingress Setup with HTTPS and Custom Domain

This guide explains how to set up Nginx Ingress Controller with HTTPS and a custom local domain for the Datadog Observability Playground.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Installation Steps](#installation-steps)
5. [Configuration Details](#configuration-details)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

## Overview

This setup provides:
- **Custom Domain**: `datadog-playground.local` for local development
- **HTTPS/TLS**: Self-signed certificate for secure connections
- **Single Entry Point**: Nginx Ingress routes to all backend services
- **Path-Based Routing**: `/api`, `/auth`, `/orders` routes to respective services
- **Dual Access**: Ingress on ports 30081/30444, direct frontend on 30080 (for learning)

## Prerequisites

- Docker Desktop with Kubernetes enabled
- `kubectl` configured for local cluster
- `openssl` installed (for certificate generation)
- Helm installed (for nginx-ingress installation)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser / Client                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (port 30444) or HTTP (30081)
                              │ https://datadog-playground.local:30444
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Nginx Ingress Controller (NodePort)                 │
│                                                                   │
│  TLS Termination: datadog-playground-tls secret                  │
│  - Certificate: k8/certs/tls.crt                                 │
│  - Private Key: k8/certs/tls.key                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┬─────────────┐
              │               │               │             │
              ▼               ▼               ▼             ▼
         ┌─────────┐    ┌─────────┐    ┌─────────┐   ┌─────────┐
         │Frontend │    │   API   │    │  Auth   │   │ Orders  │
         │Service  │    │Service  │    │Service  │   │Service  │
         │ Port 80 │    │Port 3000│    │Port 3002│   │Port 3001│
         └─────────┘    └─────────┘    └─────────┘   └─────────┘
              │               │               │             │
         ┌─────────┐    ┌─────────┐    ┌─────────┐   ┌─────────┐
         │Frontend │    │   App   │    │  User   │   │ Order   │
         │  Pods   │    │  Pods   │    │  Pods   │   │  Pods   │
         └─────────┘    └─────────┘    └─────────┘   └─────────┘
```

### Request Flow

1. **Browser** → `https://datadog-playground.local:30444/api/products`
2. **DNS Resolution** → `/etc/hosts` resolves `datadog-playground.local` to `127.0.0.1`
3. **TLS Handshake** → Nginx Ingress terminates TLS using self-signed certificate
4. **Path Routing** → Ingress routes `/api/*` to `dd-app-api-service:3000`
5. **Path Rewrite** → `/api/products` becomes `/products` before reaching backend
6. **Service Response** → API responds, Nginx forwards back through TLS to browser

**Note**: Port 30080 is used by the frontend-service NodePort for direct access (learning purpose).

## Installation Steps

**Note**: The scripts are numbered (1-, 2-, 3-) to indicate the recommended execution order for initial setup.

### Step 1: Install Nginx Ingress Controller

```bash
# Add Helm repository
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install nginx-ingress controller
# Note: Using ports 30081/30444 because 30080 is used by frontend-service
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=NodePort \
  --set controller.service.nodePorts.http=30081 \
  --set controller.service.nodePorts.https=30444 \
  --set controller.ingressClassResource.default=true \
  --set controller.metrics.enabled=true

# Verify installation
kubectl get pods -n ingress-nginx
kubectl get svc -n ingress-nginx
```

Expected output:
```
NAME                                        TYPE       CLUSTER-IP      EXTERNAL-IP   PORT(S)
nginx-ingress-ingress-nginx-controller      NodePort   10.96.xxx.xxx   <none>        80:30081/TCP,443:30444/TCP
```

### Step 2: Generate TLS Certificate

```bash
# Run the certificate generation script
bash k8/scripts/1-generate-tls-cert.sh
```

This creates:
- `k8/certs/tls.crt` - Self-signed certificate
- `k8/certs/tls.key` - Private key
- Valid for 365 days
- Subject Alternative Names: `datadog-playground.local`, `*.datadog-playground.local`

### Step 3: Create Kubernetes TLS Secret

```bash
# Create the TLS secret in Kubernetes
bash k8/scripts/2-create-tls-secret.sh

# Verify the secret
kubectl get secret datadog-playground-tls -o yaml
```

### Step 4: Deploy Ingress Resource

```bash
# Apply the ingress configuration
kubectl apply -f k8/definations/ingress.yaml

# Verify ingress
kubectl get ingress
kubectl describe ingress datadog-playground-ingress
```

Expected output:
```
NAME                          CLASS   HOSTS                        ADDRESS     PORTS     AGE
datadog-playground-ingress    nginx   datadog-playground.local     localhost   80, 443   10s
```

### Step 5: Update /etc/hosts

```bash
# Add custom domain to /etc/hosts (requires sudo)
sudo bash k8/scripts/3-update-hosts.sh

# Verify the entry
grep datadog-playground.local /etc/hosts
```

Expected entry:
```
127.0.0.1 datadog-playground.local # Datadog Playground Local K8s
```

### Step 6: Test the Setup

```bash
# Test DNS resolution
ping datadog-playground.local

# Test HTTP redirect (should redirect to HTTPS)
curl -I http://datadog-playground.local:30081

# Test HTTPS (ignore certificate warning for self-signed cert)
curl -k https://datadog-playground.local:30444

# Test API endpoint
curl -k https://datadog-playground.local:30444/api/products

# Test auth endpoint
curl -k https://datadog-playground.local:30444/auth/health
```

Access in browser:
- **Via Ingress (HTTPS)**: https://datadog-playground.local:30444
- **Via Ingress (HTTP)**: http://datadog-playground.local:30081
- **Direct Frontend**: http://localhost:30080 (NodePort, for learning)
- API: https://datadog-playground.local:30444/api/products
- Auth: https://datadog-playground.local:30444/auth/login

**Note**: Your browser will show a security warning because it's a self-signed certificate. Click "Advanced" → "Proceed" to continue.

## Configuration Details

### Ingress Annotations

```yaml
annotations:
  # Path rewriting - removes prefix before forwarding to backend
  nginx.ingress.kubernetes.io/rewrite-target: /$2

  # Force HTTPS - redirect HTTP to HTTPS
  nginx.ingress.kubernetes.io/ssl-redirect: "true"
  nginx.ingress.kubernetes.io/force-ssl-redirect: "true"

  # CORS configuration
  nginx.ingress.kubernetes.io/enable-cors: "true"
  nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
  nginx.ingress.kubernetes.io/cors-allow-origin: "*"

  # Rate limiting - 100 requests per second
  nginx.ingress.kubernetes.io/rate-limit: "100"
```

### Path Routing Rules

| Path Pattern | Backend Service | Backend Port | Rewrite Example |
|-------------|----------------|--------------|-----------------|
| `/()(.*)` | frontend-service | 80 | `/` → `/` |
| `/api(/\|$)(.*)` | dd-app-api-service | 3000 | `/api/products` → `/products` |
| `/auth(/\|$)(.*)` | user-auth-service | 3002 | `/auth/login` → `/login` |
| `/orders(/\|$)(.*)` | order-service | 3001 | `/orders/123` → `/123` |

### Path Rewriting Explained

The regex pattern `nginx.ingress.kubernetes.io/rewrite-target: /$2` works with path definitions:

```yaml
path: /api(/|$)(.*)
```

- `$1` = First capture group: `(/|$)` - matches `/` or end of string
- `$2` = Second capture group: `(.*)` - captures everything after `/api/`
- Result: `/api/products` → `$2 = products` → rewritten to `/products`

Example transformations:
- `/api/products` → `/products`
- `/api/products/123` → `/products/123`
- `/auth/login` → `/login`
- `/orders/123/items` → `/123/items`

### TLS Configuration

```yaml
spec:
  tls:
  - hosts:
    - datadog-playground.local
    secretName: datadog-playground-tls
```

The TLS secret contains:
- `tls.crt`: X.509 certificate (base64 encoded)
- `tls.key`: RSA private key (base64 encoded)

## Testing

### 1. Test Frontend Access

```bash
# Via Ingress (HTTPS)
curl -k https://datadog-playground.local:30444

# Via Direct NodePort (HTTP)
curl http://localhost:30080

# Open in browser (Ingress)
open https://datadog-playground.local:30444

# Open direct frontend (NodePort)
open http://localhost:30080
```

### 2. Test API Routing

```bash
# Get products (via Ingress)
curl -k https://datadog-playground.local:30444/api/products

# Get specific product
curl -k https://datadog-playground.local:30444/api/products/1

# Test with authentication
curl -k -X POST https://datadog-playground.local:30444/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

### 3. Test HTTPS Redirect

```bash
# Should return 308 redirect to HTTPS
curl -I http://datadog-playground.local:30081
```

Expected response:
```
HTTP/1.1 308 Permanent Redirect
Location: https://datadog-playground.local:30444/
```

### 4. Verify Ingress Configuration

```bash
# Check ingress status
kubectl get ingress datadog-playground-ingress

# Get detailed information
kubectl describe ingress datadog-playground-ingress

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

### 5. Test Certificate

```bash
# View certificate details
openssl s_client -connect datadog-playground.local:30444 -servername datadog-playground.local < /dev/null 2>/dev/null | openssl x509 -noout -text

# Check certificate expiry
openssl s_client -connect datadog-playground.local:30444 < /dev/null 2>/dev/null | openssl x509 -noout -dates
```

## Troubleshooting

### Issue 1: "Unable to connect" or "Connection refused"

**Symptoms**: Cannot reach https://datadog-playground.local:30444

**Check**:
```bash
# Verify ingress controller is running
kubectl get pods -n ingress-nginx

# Check NodePort service
kubectl get svc -n ingress-nginx
```

**Fix**: Ensure the ingress-nginx-controller pod is Running and NodePorts are 30081/30444

### Issue 2: "404 Not Found" from Nginx

**Symptoms**: Nginx responds but returns 404

**Check**:
```bash
# Verify ingress rules are loaded
kubectl describe ingress datadog-playground-ingress

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller --tail=50
```

**Fix**: Ensure backend services exist and are accessible:
```bash
kubectl get svc frontend-service dd-app-api-service user-auth-service order-service
```

### Issue 3: "NET::ERR_CERT_INVALID" in browser

**Symptoms**: Browser shows certificate error

**Explanation**: This is expected for self-signed certificates

**Fix**: Click "Advanced" → "Proceed to datadog-playground.local (unsafe)"

Or, trust the certificate (macOS):
```bash
# Add certificate to keychain
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain k8/certs/tls.crt
```

### Issue 4: Domain not resolving

**Symptoms**: `ping: cannot resolve datadog-playground.local`

**Check**:
```bash
# Verify /etc/hosts entry
grep datadog-playground.local /etc/hosts
```

**Fix**: Run the hosts update script:
```bash
sudo bash k8/scripts/3-update-hosts.sh
```

### Issue 5: Backend service not responding

**Symptoms**: Ingress works but specific paths return errors

**Check**:
```bash
# Test service directly (port-forward)
kubectl port-forward svc/dd-app-api-service 8080:3000
curl http://localhost:8080/products

# Check pod logs
kubectl get pods
kubectl logs <pod-name>
```

**Fix**: Ensure the backend service and pods are running correctly

### Issue 6: Path rewriting issues

**Symptoms**: Backend returns 404 but Ingress is working

**Problem**: Backend expects different path structure

**Solution**: Use the alternative simpler ingress configuration without rewriting:

```bash
# The alternative version is commented in k8/definations/ingress.yaml
# It doesn't rewrite paths, so backends receive full paths including /api, /auth
```

Uncomment the alternative ingress definition if your backends expect full paths.

## Files Created

```
k8/
├── certs/
│   ├── tls.crt                       # Self-signed certificate
│   ├── tls.key                       # Private key
│   └── tls.csr                       # Certificate signing request
├── scripts/
│   ├── 1-generate-tls-cert.sh        # Generate TLS certificates
│   ├── 2-create-tls-secret.sh        # Create Kubernetes TLS secret
│   └── 3-update-hosts.sh             # Update /etc/hosts with custom domain
└── definations/
    ├── ingress.yaml                  # Ingress resource definition
    ├── app-deployment.yaml           # Application deployments
    ├── frontend-deployment.yaml      # Frontend deployment
    ├── user-auth-deployment.yaml     # User auth deployment
    ├── order-service-deployment.yaml # Order service deployment
    ├── mongo-deployment.yaml         # MongoDB deployment
    ├── *-service.yaml                # Service definitions
    └── ... (other K8s manifests)

docs/
└── INGRESS_SETUP.md                  # This documentation
```

## Cleanup

To remove the ingress setup:

```bash
# Delete ingress resource
kubectl delete -f k8/definations/ingress.yaml

# Delete TLS secret
kubectl delete secret datadog-playground-tls

# Uninstall nginx-ingress controller
helm uninstall nginx-ingress -n ingress-nginx

# Remove /etc/hosts entry
sudo sed -i '' '/datadog-playground.local/d' /etc/hosts

# Remove certificates (optional - useful for regenerating)
rm -rf k8/certs/*.crt k8/certs/*.key k8/certs/*.csr
```

## Comparison: Docker Desktop vs Minikube

### Docker Desktop

- **No addon system**: Must install ingress controller via Helm or kubectl
- **NodePort access**: Services on localhost ports (30080, 30443)
- **No default backend**: Returns 404 until ingress controller is installed
- **TLS handling**: Must create TLS secrets manually

### Minikube

- **Addon system**: `minikube addons enable ingress` (one command)
- **Automatic setup**: Installs nginx-ingress automatically
- **Default backend**: Provides default 404 page immediately
- **Tunnel required**: Need `minikube tunnel` for LoadBalancer services
- **IP access**: Use `minikube ip` to get cluster IP

### Key Differences

| Feature | Docker Desktop | Minikube |
|---------|---------------|----------|
| Installation | Helm install | `minikube addons enable` |
| Access Method | NodePort (localhost:30443) | Tunnel + ClusterIP |
| Default Backend | No | Yes |
| Setup Complexity | Manual (4-5 steps) | Automatic (1 command) |
| TLS Setup | Manual cert generation | Manual cert generation |

## Next Steps

1. **Production Setup**: For EKS, use AWS Load Balancer Controller (see main README)
2. **Monitoring**: Enable ingress metrics and set up Datadog APM
3. **Security**: Use Let's Encrypt for production certificates
4. **Custom Domain**: Purchase domain and configure DNS for production

## References

- [Nginx Ingress Controller Documentation](https://kubernetes.github.io/ingress-nginx/)
- [Kubernetes Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [TLS Secrets](https://kubernetes.io/docs/concepts/configuration/secret/#tls-secrets)
- [Path Rewriting](https://kubernetes.github.io/ingress-nginx/examples/rewrite/)
