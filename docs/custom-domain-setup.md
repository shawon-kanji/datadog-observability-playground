# Custom Domain Setup Guide

Setting up a custom domain (e.g., `api.yourdomain.com`) for your Datadog Observability Playground.

## Table of Contents

1. [Option 1: Direct ALB Connection](#option-1-direct-alb-connection-recommended)
2. [Option 2: CloudFront + ALB](#option-2-cloudfront--alb)
3. [Comparison](#comparison)
4. [Updating CDK Stack](#updating-cdk-stack)

---

## Option 1: Direct ALB Connection (Recommended)

**Architecture:**
```
User → api.yourdomain.com → Route 53 → ALB → ECS Tasks
```

**Best for:** APIs, WebSocket apps, maintaining client IPs

### Step 1: Request SSL Certificate in ACM

**Via AWS Console:**
1. Go to **AWS Certificate Manager (ACM)**
2. Click **Request certificate**
3. Choose **Request a public certificate**
4. Enter domain: `api.yourdomain.com`
5. Validation method: **DNS validation** (recommended)
6. Click **Request**

**Via AWS CLI:**
```bash
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS \
  --region ap-southeast-1

# Output: Certificate ARN
# arn:aws:acm:ap-southeast-1:123456789012:certificate/abc123...
```

### Step 2: Validate Certificate

**DNS Validation (Recommended):**

After requesting the certificate:

1. **Get validation records:**
   ```bash
   aws acm describe-certificate \
     --certificate-arn arn:aws:acm:region:account:certificate/abc123 \
     --region ap-southeast-1
   ```

2. **Add CNAME record to Route 53:**
   - Name: `_abc123.api.yourdomain.com`
   - Type: CNAME
   - Value: `_xyz789.acm-validations.aws.`

3. **Wait for validation** (usually 5-10 minutes)
   ```bash
   aws acm wait certificate-validated \
     --certificate-arn arn:aws:acm:region:account:certificate/abc123 \
     --region ap-southeast-1
   ```

### Step 3: Update CDK Stack

Add HTTPS listener to your ALB:

```typescript
// packages/cdk/lib/datadog-app-stack.ts

export interface DatadogAppStackProps extends cdk.StackProps {
  // ... existing props

  /**
   * Custom domain name (e.g., api.yourdomain.com)
   * Leave empty for ALB default URL
   */
  domainName?: string;

  /**
   * ACM Certificate ARN for HTTPS
   * Required if domainName is provided
   */
  certificateArn?: string;

  /**
   * Route 53 Hosted Zone ID
   * Required if domainName is provided
   */
  hostedZoneId?: string;
}

// In the stack constructor, after creating ALB:

// Get certificate if provided
let certificate: acm.ICertificate | undefined;
if (props?.certificateArn) {
  certificate = acm.Certificate.fromCertificateArn(
    this,
    'Certificate',
    props.certificateArn
  );
}

// Create HTTPS listener if certificate exists
if (certificate) {
  const httpsListener = alb.addListener('HttpsListener', {
    port: 443,
    protocol: elbv2.ApplicationProtocol.HTTPS,
    certificates: [certificate],
    defaultTargetGroups: [targetGroup],
  });

  // Redirect HTTP to HTTPS
  const httpListener = alb.addListener('HttpListener', {
    port: 80,
    protocol: elbv2.ApplicationProtocol.HTTP,
    defaultAction: elbv2.ListenerAction.redirect({
      protocol: 'HTTPS',
      port: '443',
      permanent: true,
    }),
  });
} else {
  // Keep existing HTTP-only listener
  alb.addListener('HttpListener', {
    port: 80,
    protocol: elbv2.ApplicationProtocol.HTTP,
    defaultTargetGroups: [targetGroup],
  });
}

// Create Route 53 record if domain provided
if (props?.domainName && props?.hostedZoneId) {
  const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
    this,
    'HostedZone',
    {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName.split('.').slice(-2).join('.'),
    }
  );

  new route53.ARecord(this, 'AliasRecord', {
    zone: hostedZone,
    recordName: props.domainName,
    target: route53.RecordTarget.fromAlias(
      new route53Targets.LoadBalancerTarget(alb)
    ),
  });
}

// Update output
new cdk.CfnOutput(this, 'ApplicationUrl', {
  value: props?.domainName
    ? `https://${props.domainName}`
    : `http://${alb.loadBalancerDnsName}`,
  description: 'Application URL',
});
```

### Step 4: Deploy with Custom Domain

**Update CDK context:**

```bash
# packages/cdk/cdk.json
{
  "context": {
    "domainName": "api.yourdomain.com",
    "certificateArn": "arn:aws:acm:ap-southeast-1:123456789012:certificate/abc123",
    "hostedZoneId": "Z1234567890ABC"
  }
}
```

**Or pass via command line:**

```bash
pnpm cdk:deploy \
  --context domainName=api.yourdomain.com \
  --context certificateArn=arn:aws:acm:region:account:certificate/abc123 \
  --context hostedZoneId=Z1234567890ABC
```

**Or update `bin/app.ts`:**

```typescript
// packages/cdk/bin/app.ts

const domainName = app.node.tryGetContext('domainName');
const certificateArn = app.node.tryGetContext('certificateArn');
const hostedZoneId = app.node.tryGetContext('hostedZoneId');

new DatadogAppStack(app, `DatadogAppStack-${environment}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-1',
  },
  environment,
  domainName,
  certificateArn,
  hostedZoneId,
  // ... other props
});
```

### Step 5: Deploy

```bash
./scripts/deploy.sh dev
```

### Step 6: Test

```bash
# Test HTTPS
curl https://api.yourdomain.com/health

# Test HTTP redirect
curl -I http://api.yourdomain.com/health
# Should return 301 redirect to HTTPS

# Test API
curl https://api.yourdomain.com/api/products
```

---

## Option 2: CloudFront + ALB

**Architecture:**
```
User → api.yourdomain.com → Route 53 → CloudFront → ALB → ECS Tasks
```

**Best for:** Global apps, static content caching, DDoS protection

### Step 1: Request Certificate in us-east-1

**Important:** CloudFront requires certificates in **us-east-1** region!

```bash
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS \
  --region us-east-1  # ← Must be us-east-1 for CloudFront!
```

Validate as shown in Option 1.

### Step 2: Update CDK Stack with CloudFront

```typescript
// packages/cdk/lib/datadog-app-stack.ts

import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

// After creating ALB...

if (props?.domainName && props?.certificateArn) {
  // Import certificate (must be in us-east-1)
  const certificate = acm.Certificate.fromCertificateArn(
    this,
    'CloudFrontCertificate',
    props.certificateArn  // This cert must be in us-east-1
  );

  // Create CloudFront distribution
  const distribution = new cloudfront.Distribution(this, 'Distribution', {
    defaultBehavior: {
      origin: new origins.LoadBalancerV2Origin(alb, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      }),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,  // For API
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
    },
    domainNames: [props.domainName],
    certificate,
    priceClass: cloudfront.PriceClass.PRICE_CLASS_100,  // US, Canada, Europe
  });

  // Create Route 53 record pointing to CloudFront
  if (props?.hostedZoneId) {
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      'HostedZone',
      {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.domainName.split('.').slice(-2).join('.'),
      }
    );

    new route53.ARecord(this, 'CloudFrontAliasRecord', {
      zone: hostedZone,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(distribution)
      ),
    });
  }

  // Output
  new cdk.CfnOutput(this, 'CloudFrontUrl', {
    value: `https://${props.domainName}`,
    description: 'CloudFront URL',
  });

  new cdk.CfnOutput(this, 'CloudFrontDomain', {
    value: distribution.distributionDomainName,
    description: 'CloudFront Domain Name',
  });
}
```

### Important CloudFront Considerations

**1. Disable Caching for APIs:**
```typescript
cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
```

**2. Forward All Headers (for APIs):**
```typescript
originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
```

**3. Client IP Preservation:**
CloudFront adds `X-Forwarded-For` header. Update your app:

```typescript
// packages/app/src/app.ts

// Trust CloudFront
app.set('trust proxy', true);

// Get real IP
app.use((req, res, next) => {
  const realIp = req.ip || req.headers['x-forwarded-for'];
  logger.info({ ip: realIp }, 'Request from IP');
  next();
});
```

### Step 3: Deploy

```bash
./scripts/deploy.sh dev
```

**Note:** CloudFront deployment takes **15-20 minutes** to propagate globally.

### Step 4: Test

```bash
# Wait for CloudFront to deploy
aws cloudfront wait distribution-deployed \
  --id E1234567890ABC

# Test
curl https://api.yourdomain.com/health
```

---

## Comparison

| Feature | Direct ALB | CloudFront + ALB |
|---------|-----------|------------------|
| **Setup Complexity** | Simple ✅ | Complex ⚠️ |
| **Cost** | Lower ($16/mo for ALB) | Higher (+$0.01/10k req) |
| **Latency** | Lower (1 hop) | Higher (2 hops) |
| **Global Performance** | Regional | Global ✅ |
| **Caching** | None | Yes ✅ |
| **DDoS Protection** | Basic (AWS Shield) | Advanced ✅ |
| **WAF** | Can attach | Can attach ✅ |
| **Certificate Region** | Same as ALB | Must be us-east-1 |
| **Client IP** | Preserved ✅ | In X-Forwarded-For |
| **WebSocket** | Native ✅ | Supported |
| **Deployment Time** | Fast (5 min) | Slow (15-20 min) |
| **Best For** | APIs, WebSockets | Global apps, static content |

---

## Recommendations

### Use Direct ALB When:
- ✅ Building an API (like this project)
- ✅ Need low latency
- ✅ Regional traffic (Asia Pacific only)
- ✅ Want simpler setup
- ✅ Need to preserve client IPs
- ✅ Budget-conscious

### Use CloudFront When:
- ✅ Global user base
- ✅ Need edge caching
- ✅ Serving static assets
- ✅ Need advanced DDoS protection
- ✅ Want WAF at edge
- ✅ Need Lambda@Edge

### For This Project:
**Recommendation: Direct ALB** ✅

Because:
- It's an API (no caching needed)
- Learning project (simpler is better)
- Regional deployment
- Lower cost

---

## Getting Hosted Zone ID

**If you already have a domain in Route 53:**

```bash
aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='yourdomain.com.'].Id" \
  --output text
```

**If you need to create one:**

```bash
aws route53 create-hosted-zone \
  --name yourdomain.com \
  --caller-reference $(date +%s)
```

Then update your domain's nameservers at your registrar (GoDaddy, Namecheap, etc.) to point to AWS Route 53 nameservers.

---

## Cost Estimates

### Direct ALB Setup:
- Application Load Balancer: $16/month
- Route 53 Hosted Zone: $0.50/month
- Route 53 Queries: $0.40/million
- ACM Certificate: **FREE** ✅
- **Total: ~$17/month**

### CloudFront + ALB Setup:
- Everything above: $17/month
- CloudFront requests: $0.01/10,000 requests
- CloudFront data transfer: $0.085/GB
- **Total: ~$20-30/month** (depending on traffic)

---

## Troubleshooting

### Certificate Validation Stuck

**Check DNS propagation:**
```bash
dig _abc123.api.yourdomain.com CNAME
```

**Verify in Route 53:**
```bash
aws route53 list-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --query "ResourceRecordSets[?Name=='_abc123.api.yourdomain.com.']"
```

### HTTPS Not Working

**Check certificate status:**
```bash
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:region:account:certificate/abc123
```

**Check ALB listener:**
```bash
aws elbv2 describe-listeners \
  --load-balancer-arn arn:aws:elasticloadbalancing:...
```

### CloudFront Not Routing to ALB

**Check origin configuration:**
```bash
aws cloudfront get-distribution \
  --id E1234567890ABC
```

**Check ALB is accepting CloudFront:**
- ALB security group must allow HTTPS from CloudFront IPs
- Or allow all HTTPS (0.0.0.0/0) since ALB is public

---

## Security Best Practices

### 1. Force HTTPS
```typescript
// Redirect HTTP to HTTPS
defaultAction: elbv2.ListenerAction.redirect({
  protocol: 'HTTPS',
  port: '443',
  permanent: true,
}),
```

### 2. Enable Access Logs
```typescript
alb.logAccessLogs(
  s3.Bucket.fromBucketName(this, 'LogBucket', 'my-alb-logs-bucket')
);
```

### 3. Add WAF (Optional)
```typescript
const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
  scope: 'REGIONAL',  // For ALB
  // scope: 'CLOUDFRONT',  // For CloudFront
  defaultAction: { allow: {} },
  rules: [
    // Rate limiting
    {
      name: 'RateLimitRule',
      priority: 1,
      statement: {
        rateBasedStatement: {
          limit: 2000,  // requests per 5 minutes
          aggregateKeyType: 'IP',
        },
      },
      action: { block: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'RateLimitRule',
      },
    },
  ],
  visibilityConfig: {
    sampledRequestsEnabled: true,
    cloudWatchMetricsEnabled: true,
    metricName: 'WebAcl',
  },
});

new wafv2.CfnWebACLAssociation(this, 'WebAclAssociation', {
  resourceArn: alb.loadBalancerArn,
  webAclArn: webAcl.attrArn,
});
```

---

## Next Steps

1. **Choose your approach** (Direct ALB recommended)
2. **Request ACM certificate**
3. **Update CDK stack** with code above
4. **Deploy** and test
5. **Update Datadog** with new domain
6. **Monitor** performance in Datadog

---

## Additional Resources

- [AWS Certificate Manager](https://docs.aws.amazon.com/acm/)
- [Route 53 Documentation](https://docs.aws.amazon.com/route53/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [ALB HTTPS Listeners](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html)
