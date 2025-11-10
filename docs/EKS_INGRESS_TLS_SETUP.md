# EKS Ingress TLS Setup Guide

This guide covers TLS/HTTPS setup for Kubernetes Ingress on AWS EKS.

## Table of Contents

1. [Option 1: AWS Load Balancer Controller + ACM (Recommended)](#option-1-aws-load-balancer-controller--acm-recommended)
2. [Option 2: Nginx Ingress Controller + Kubernetes Secrets](#option-2-nginx-ingress-controller--kubernetes-secrets)
3. [Comparison](#comparison)

---

## Option 1: AWS Load Balancer Controller + ACM (Recommended)

This approach uses AWS Certificate Manager (ACM) for SSL certificates and Application Load Balancer (ALB) for routing.

### Architecture

```
Browser
  ↓ HTTPS (443)
AWS ALB (with ACM certificate)
  ↓ HTTP (unencrypted inside VPC)
Backend Pods (frontend, api, auth)
```

**Key Point**: TLS terminates at the ALB, backend communication is HTTP (inside secure VPC).

### Prerequisites

- Domain name (e.g., `datadog-playground.example.com`)
- Route53 hosted zone (or ability to add DNS records)
- EKS cluster running
- AWS Load Balancer Controller installed

### Step 1: Request Certificate in ACM

#### Option A: Using AWS Console

1. Go to AWS Certificate Manager (ACM)
2. Click "Request certificate"
3. Choose "Request a public certificate"
4. Enter domain names:
   - `datadog-playground.example.com`
   - `*.datadog-playground.example.com` (wildcard for subdomains)
5. Validation method: DNS validation (recommended)
6. Add DNS records to Route53 (ACM provides the records)
7. Wait for status to become "Issued"

#### Option B: Using AWS CLI

```bash
# Request certificate
aws acm request-certificate \
  --domain-name datadog-playground.example.com \
  --subject-alternative-names *.datadog-playground.example.com \
  --validation-method DNS \
  --region us-east-1

# Output will include CertificateArn - save this!
# Example: arn:aws:acm:us-east-1:123456789012:certificate/abc123...

# Get validation records
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:123456789012:certificate/abc123... \
  --region us-east-1

# Add the CNAME records to Route53 for validation
```

### Step 2: Install AWS Load Balancer Controller

```bash
# 1. Create IAM policy
curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.0/docs/install/iam_policy.json

aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam-policy.json

# 2. Get your AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
CLUSTER_NAME=your-cluster-name
REGION=us-east-1

# 3. Create IAM service account
eksctl create iamserviceaccount \
  --cluster=${CLUSTER_NAME} \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=arn:aws:iam::${AWS_ACCOUNT_ID}:policy/AWSLoadBalancerControllerIAMPolicy \
  --override-existing-serviceaccounts \
  --region=${REGION} \
  --approve

# 4. Install controller via Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=${CLUSTER_NAME} \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller

# 5. Verify installation
kubectl get deployment -n kube-system aws-load-balancer-controller
```

### Step 3: Create Ingress with ACM Certificate

Create `k8-eks/ingress-alb-tls.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: datadog-playground-ingress
  namespace: default
  annotations:
    # ALB configuration
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip

    # HTTPS/TLS configuration
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'

    # ACM Certificate ARN - REPLACE WITH YOUR ARN
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-east-1:123456789012:certificate/abc123...

    # Health check configuration
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: '15'
    alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '5'
    alb.ingress.kubernetes.io/healthy-threshold-count: '2'
    alb.ingress.kubernetes.io/unhealthy-threshold-count: '2'

    # Backend protocol (HTTP inside VPC)
    alb.ingress.kubernetes.io/backend-protocol: HTTP

    # Tags for AWS resources
    alb.ingress.kubernetes.io/tags: Environment=production,Team=platform

spec:
  ingressClassName: alb
  rules:
  - host: datadog-playground.example.com
    http:
      paths:
      # Frontend
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80

      # API routes
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: dd-app-api-service
            port:
              number: 3000

      # Auth routes
      - path: /auth
        pathType: Prefix
        backend:
          service:
            name: user-auth-service
            port:
              number: 3002

      # Order routes
      - path: /orders
        pathType: Prefix
        backend:
          service:
            name: order-service
            port:
              number: 3001
```

### Step 4: Deploy and Configure DNS

```bash
# Deploy the ingress
kubectl apply -f k8-eks/ingress-alb-tls.yaml

# Wait for ALB to be created (takes 2-3 minutes)
kubectl get ingress datadog-playground-ingress -w

# Get the ALB DNS name
ALB_DNS=$(kubectl get ingress datadog-playground-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "ALB DNS: $ALB_DNS"
```

### Step 5: Add DNS Record in Route53

**Option A: Using AWS Console**
1. Go to Route53 → Hosted Zones
2. Select your hosted zone
3. Create record:
   - Name: `datadog-playground`
   - Type: `A` (Alias)
   - Alias target: Select the ALB
   - Routing policy: Simple

**Option B: Using AWS CLI**

```bash
HOSTED_ZONE_ID="Z1234567890ABC"  # Your Route53 hosted zone ID
ALB_HOSTED_ZONE_ID="Z35SXDOTRQ7X7K"  # ALB's hosted zone (region-specific)

# Get ALB hosted zone ID (varies by region)
# us-east-1: Z35SXDOTRQ7X7K
# us-west-2: Z1H1FL5HABSF5
# See: https://docs.aws.amazon.com/general/latest/gr/elb.html

cat > change-batch.json <<EOF
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "datadog-playground.example.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "${ALB_HOSTED_ZONE_ID}",
          "DNSName": "${ALB_DNS}",
          "EvaluateTargetHealth": true
        }
      }
    }
  ]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id ${HOSTED_ZONE_ID} \
  --change-batch file://change-batch.json
```

### Step 6: Test HTTPS Access

```bash
# Test HTTPS (should work)
curl -I https://datadog-playground.example.com

# Test HTTP (should redirect to HTTPS)
curl -I http://datadog-playground.example.com

# Test API endpoint
curl https://datadog-playground.example.com/api/products

# Test certificate
openssl s_client -connect datadog-playground.example.com:443 -servername datadog-playground.example.com < /dev/null 2>/dev/null | openssl x509 -noout -issuer -subject -dates
```

### Benefits of This Approach

✅ **Free SSL certificates** from AWS Certificate Manager
✅ **Auto-renewal** - ACM handles certificate renewal
✅ **No certificate management** in Kubernetes
✅ **Better performance** - TLS termination at ALB
✅ **AWS-native integration**
✅ **No nginx overhead**
✅ **Trusted certificates** - No browser warnings

---

## Option 2: Nginx Ingress Controller + Kubernetes Secrets

This approach uses nginx-ingress with TLS secrets in Kubernetes (similar to local setup).

### Architecture

```
Browser
  ↓ HTTPS (443)
AWS NLB
  ↓ HTTPS (443)
Nginx Ingress Controller Pod (TLS termination here)
  ↓ HTTP
Backend Pods
```

### Step 1: Install Nginx Ingress Controller

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-type"="nlb" \
  --set controller.ingressClassResource.default=true \
  --set controller.metrics.enabled=true

# Wait for NLB to be created
kubectl get svc -n ingress-nginx -w
```

### Step 2: Get SSL Certificate

#### Option A: Use Let's Encrypt with cert-manager (Recommended for production)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create Let's Encrypt issuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

#### Option B: Use your own certificate

```bash
# If you have a certificate from a CA
kubectl create secret tls datadog-playground-tls \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key \
  -n default
```

#### Option C: Self-signed certificate (testing only)

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key \
  -out tls.crt \
  -subj "/CN=datadog-playground.example.com/O=Datadog Playground"

# Create Kubernetes secret
kubectl create secret tls datadog-playground-tls \
  --cert=tls.crt \
  --key=tls.key \
  -n default
```

### Step 3: Create Ingress with TLS

Create `k8-eks/ingress-nginx-tls.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: datadog-playground-ingress
  namespace: default
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"

    # If using cert-manager with Let's Encrypt
    cert-manager.io/cluster-issuer: "letsencrypt-prod"

    # CORS (if needed)
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-origin: "*"

spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - datadog-playground.example.com
    secretName: datadog-playground-tls  # cert-manager will create this automatically

  rules:
  - host: datadog-playground.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80

      - path: /api
        pathType: Prefix
        backend:
          service:
            name: dd-app-api-service
            port:
              number: 3000

      - path: /auth
        pathType: Prefix
        backend:
          service:
            name: user-auth-service
            port:
              number: 3002

      - path: /orders
        pathType: Prefix
        backend:
          service:
            name: order-service
            port:
              number: 3001
```

### Step 4: Deploy and Configure DNS

```bash
# Deploy ingress
kubectl apply -f k8-eks/ingress-nginx-tls.yaml

# Get NLB DNS name
NLB_DNS=$(kubectl get svc nginx-ingress-ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "NLB DNS: $NLB_DNS"

# Create Route53 record (same as Option 1, but pointing to NLB)
```

### Step 5: Test

```bash
# Test HTTPS
curl -I https://datadog-playground.example.com

# If using self-signed cert, use -k flag
curl -k https://datadog-playground.example.com
```

---

## Comparison

| Feature | AWS LB Controller + ACM | Nginx Ingress + TLS Secrets |
|---------|------------------------|----------------------------|
| **Certificate Management** | Automatic (ACM) | Manual or cert-manager |
| **Certificate Cost** | Free | Free (Let's Encrypt) or Paid |
| **Auto-renewal** | Yes (ACM) | Yes (cert-manager) or Manual |
| **Browser Warnings** | No (trusted CA) | No (if using real cert) |
| **TLS Termination** | At ALB (outside cluster) | At nginx pod (inside cluster) |
| **Backend Protocol** | HTTP (unencrypted in VPC) | HTTP (unencrypted in cluster) |
| **Performance** | Better (native AWS) | Good (nginx overhead) |
| **Cost** | ~$16/month (ALB) | ~$16/month (NLB) |
| **Setup Complexity** | Medium | Medium-High |
| **AWS Integration** | Excellent | Basic |
| **Portability** | AWS only | Any cloud |
| **Learning Value** | AWS-specific | General Kubernetes |

## Recommendations

### For Production on EKS:
✅ **Use AWS Load Balancer Controller + ACM**
- Free SSL certificates
- Automatic renewal
- Better performance
- Native AWS integration

### For Learning/Multi-cloud:
✅ **Use Nginx Ingress + cert-manager**
- Works on any Kubernetes cluster
- Better understanding of Ingress concepts
- More portable across clouds

### For Quick Testing:
✅ **Use Nginx Ingress + self-signed certificate**
- Fastest setup
- No DNS/domain required
- Good for development

## Troubleshooting

### Issue: ALB not created

```bash
# Check AWS LB Controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller

# Check ingress status
kubectl describe ingress datadog-playground-ingress
```

### Issue: Certificate not trusted

- Ensure you're using a real domain (not localhost)
- Verify ACM certificate is "Issued" status
- Check certificate ARN is correct in ingress

### Issue: 502 Bad Gateway

- Check backend pods are running: `kubectl get pods`
- Verify service endpoints: `kubectl get endpoints`
- Check ALB target group health in AWS Console

### Issue: DNS not resolving

- Wait 5-10 minutes for DNS propagation
- Verify Route53 record points to correct ALB
- Test with `dig datadog-playground.example.com`

## Next Steps

1. Set up monitoring for ALB/NLB
2. Configure WAF (Web Application Firewall) on ALB
3. Set up auto-scaling for ingress controller
4. Configure rate limiting
5. Set up Datadog APM for ingress traffic monitoring

## References

- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [ACM Documentation](https://docs.aws.amazon.com/acm/)
- [cert-manager Documentation](https://cert-manager.io/)
- [Nginx Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
