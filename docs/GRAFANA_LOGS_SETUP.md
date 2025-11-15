# Grafana Logs Setup Guide

## Overview

This guide provides instructions for configuring log collection and visualization in Kubernetes environments. It covers the integration of logging systems with Grafana and explains the distinction between metrics and logs monitoring.

---

## Understanding Metrics vs Logs

### Metrics
- **Type**: Time-series numerical data
- **Examples**: CPU usage, memory consumption, request rates, latency
- **Collection**: Prometheus
- **Visualization**: Grafana dashboards
- **Query Language**: PromQL

### Logs
- **Type**: Text-based event records
- **Examples**: Application output, error messages, access logs, debug statements
- **Collection**: Fluentd, Promtail, or other log aggregators
- **Visualization**: Kibana or Grafana (with Loki)
- **Query Language**: Lucene (Elasticsearch) or LogQL (Loki)

**Important**: Prometheus collects metrics only. Log aggregation requires separate tooling such as the EFK stack (Elasticsearch, Fluentd, Kibana) or Loki.

---

## Logging Architecture Options

### Option 1: EFK Stack (Elasticsearch, Fluentd, Kibana)

#### Architecture
```
Applications → Fluentd → Elasticsearch → Kibana
```

#### Components
- **Elasticsearch**: Log storage and indexing
- **Fluentd**: Log collection and forwarding
- **Kibana**: Log visualization and search interface

#### Use Cases
- Long-term log storage
- Full-text search capabilities
- Advanced log analysis
- Compliance and audit requirements

---

### Option 2: Loki Stack (Promtail, Loki, Grafana)

#### Architecture
```
Applications → Promtail → Loki → Grafana
```

#### Components
- **Promtail**: Log collection agent
- **Loki**: Log aggregation system
- **Grafana**: Unified metrics and logs visualization

#### Use Cases
- Lightweight log aggregation
- Correlation of metrics and logs in single interface
- Cost-effective log storage
- Cloud-native environments

---

### Option 3: Hybrid Approach

#### Architecture
```
Applications → Fluentd/Promtail → Elasticsearch + Loki → Kibana + Grafana
```

#### Use Cases
- Production environments requiring redundancy
- Organizations needing both detailed log analysis and unified monitoring
- Environments with multiple teams using different tools

---

## Implementation Instructions

### Prerequisites

- Kubernetes cluster (v1.19+)
- Helm 3.x installed
- kubectl configured with cluster access
- Sufficient cluster resources (minimum 4GB RAM available)

---

## Installing Loki Stack

### Step 1: Add Helm Repository

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
```

### Step 2: Install Loki

#### Basic Installation

```bash
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --create-namespace
```

#### Custom Installation (Recommended)

Create `loki-values.yaml`:

```yaml
loki:
  enabled: true
  persistence:
    enabled: true
    size: 10Gi
  config:
    limits_config:
      retention_period: 744h  # 31 days

promtail:
  enabled: true
  config:
    clients:
      - url: http://loki:3100/loki/api/v1/push
    snippets:
      scrapeConfigs: |
        - job_name: kubernetes-pods
          kubernetes_sd_configs:
            - role: pod
          relabel_configs:
            - source_labels: [__meta_kubernetes_pod_label_app]
              target_label: app
            - source_labels: [__meta_kubernetes_namespace]
              target_label: namespace
            - source_labels: [__meta_kubernetes_pod_name]
              target_label: pod

grafana:
  enabled: false  # Use existing Grafana instance
```

Install with custom values:

```bash
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --values loki-values.yaml
```

### Step 3: Verify Installation

```bash
# Check pod status
kubectl get pods -n monitoring -l app=loki

# Check service availability
kubectl get svc -n monitoring loki
```

Expected output:
```
NAME   TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
loki   ClusterIP   10.96.xxx.xxx   <none>        3100/TCP   1m
```

---

## Installing EFK Stack

### Step 1: Add Helm Repository

```bash
helm repo add elastic https://helm.elastic.co
helm repo update
```

### Step 2: Install Elasticsearch

Create `elasticsearch-values.yaml`:

```yaml
replicas: 1
minimumMasterNodes: 1

resources:
  requests:
    cpu: "500m"
    memory: "2Gi"
  limits:
    cpu: "1000m"
    memory: "2Gi"

volumeClaimTemplate:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 30Gi
```

Install Elasticsearch:

```bash
helm install elasticsearch elastic/elasticsearch \
  --namespace logging \
  --create-namespace \
  --values elasticsearch-values.yaml
```

### Step 3: Install Fluentd

Create `fluentd-values.yaml`:

```yaml
output:
  host: elasticsearch-master
  port: 9200
  scheme: http

resources:
  limits:
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 256Mi
```

Install Fluentd:

```bash
helm install fluentd stable/fluentd \
  --namespace logging \
  --values fluentd-values.yaml
```

### Step 4: Install Kibana

Create `kibana-values.yaml`:

```yaml
elasticsearchHosts: "http://elasticsearch-master:9200"

service:
  type: ClusterIP
  port: 5601

resources:
  requests:
    cpu: "500m"
    memory: "1Gi"
  limits:
    cpu: "1000m"
    memory: "2Gi"
```

Install Kibana:

```bash
helm install kibana elastic/kibana \
  --namespace logging \
  --values kibana-values.yaml
```

---

## Configuring Grafana for Logs

### Step 1: Access Grafana

Retrieve admin credentials:

```bash
kubectl get secret <grafana-secret-name> \
  -n <namespace> \
  -o jsonpath="{.data.admin-password}" | base64 --decode
```

Port-forward to access Grafana:

```bash
kubectl port-forward svc/<grafana-service> 3000:80 -n <namespace>
```

Access at: http://localhost:3000

### Step 2: Add Loki Data Source

1. Navigate to **Configuration > Data Sources**
2. Click **Add data source**
3. Select **Loki**
4. Configure settings:
   - **Name**: Loki
   - **URL**: `http://loki:3100`
   - **Access**: Server (default)
5. Click **Save & Test**

Expected result: "Data source connected and labels found"

### Step 3: Add Elasticsearch Data Source (Optional)

1. Navigate to **Configuration > Data Sources**
2. Click **Add data source**
3. Select **Elasticsearch**
4. Configure settings:
   - **Name**: Elasticsearch
   - **URL**: `http://elasticsearch-master:9200`
   - **Index name**: `logstash-*`
   - **Time field name**: `@timestamp`
   - **Version**: 7.10+
5. Click **Save & Test**

---

## Querying Logs

### LogQL Queries (Loki)

#### Basic Queries

```logql
# All logs from a namespace
{namespace="production"}

# Logs from specific application
{app="api-service"}

# Logs with specific label
{environment="production", app="api-service"}
```

#### Filtering

```logql
# Filter by content
{app="api-service"} |= "error"

# Exclude content
{app="api-service"} != "debug"

# Regular expression
{app="api-service"} |~ "error|failed|exception"
```

#### Parsing JSON Logs

```logql
# Parse JSON and filter
{app="api-service"}
  | json
  | level="error"

# Extract fields
{app="api-service"}
  | json
  | line_format "{{.level}}: {{.message}}"
```

#### Metrics from Logs

```logql
# Count of log lines
sum(rate({app="api-service"}[5m]))

# Error rate
sum(rate({app="api-service"} |= "error" [5m]))
```

### Lucene Queries (Elasticsearch)

#### Basic Queries

```
# Field search
app:"api-service"

# Range search
timestamp:[2024-01-01 TO 2024-01-31]

# Wildcard search
message:*exception*
```

#### Boolean Operators

```
# AND
app:"api-service" AND level:"error"

# OR
level:"error" OR level:"fatal"

# NOT
app:"api-service" NOT level:"debug"
```

---

## Kibana Configuration

### Creating Index Pattern

1. Navigate to **Management > Stack Management > Index Patterns**
2. Click **Create index pattern**
3. Enter pattern: `logstash-*`
4. Click **Next step**
5. Select time field: `@timestamp`
6. Click **Create index pattern**

### Viewing Logs

1. Navigate to **Discover**
2. Select time range (top right)
3. Use search bar for filtering
4. Click on log entries to expand details

### Creating Saved Searches

1. In Discover view, apply filters
2. Click **Save** (top right)
3. Enter name and description
4. Click **Save**

---

## Grafana Explore for Logs

### Accessing Explore

1. Click **Explore** icon (compass) in left sidebar
2. Select data source (Loki or Elasticsearch)
3. Enter query in query builder
4. Adjust time range
5. Click **Run query**

### Log Panel Features

- **Live tailing**: Enable to stream logs in real-time
- **Volume histogram**: Shows log volume over time
- **Label filters**: Quick filtering by detected labels
- **Log level detection**: Automatic highlighting of error/warn levels
- **Context**: View logs before/after selected entry

---

## Creating Dashboards with Logs

### Adding Log Panel

1. Navigate to dashboard
2. Click **Add panel**
3. Select **Logs** visualization
4. Configure query:
   - Select Loki data source
   - Enter LogQL query
   - Adjust time range
5. Configure options:
   - Enable/disable time column
   - Set line wrapping
   - Configure log level colors
6. Click **Apply**

### Correlation Dashboard Example

Create dashboard showing both metrics and logs:

**Panel 1**: CPU Usage (Prometheus)
```promql
rate(container_cpu_usage_seconds_total[5m])
```

**Panel 2**: Error Logs (Loki)
```logql
{app="api-service"} |= "error"
```

**Panel 3**: Request Rate (Prometheus)
```promql
rate(http_requests_total[5m])
```

---

## Troubleshooting

### Loki Not Receiving Logs

#### Check Promtail Status

```bash
kubectl logs -n monitoring -l app=promtail
```

Look for errors in log shipping.

#### Verify Promtail Configuration

```bash
kubectl get configmap -n monitoring promtail -o yaml
```

Ensure client URL points to correct Loki service.

#### Test Connectivity

```bash
kubectl exec -n monitoring <promtail-pod> -- \
  wget -O- http://loki:3100/ready
```

Expected output: `ready`

### Grafana Cannot Connect to Loki

#### Verify Service

```bash
kubectl get svc -n monitoring loki
```

#### Test from Grafana Pod

```bash
kubectl exec -n <grafana-namespace> <grafana-pod> -- \
  wget -O- http://loki.monitoring:3100/ready
```

#### Check DNS Resolution

```bash
kubectl exec -n <grafana-namespace> <grafana-pod> -- \
  nslookup loki.monitoring
```

### No Logs Appearing in Kibana

#### Check Elasticsearch Status

```bash
kubectl exec -n logging elasticsearch-master-0 -- \
  curl -XGET 'localhost:9200/_cluster/health?pretty'
```

#### Verify Fluentd is Running

```bash
kubectl get pods -n logging -l app=fluentd
```

#### Check Elasticsearch Indices

```bash
kubectl exec -n logging elasticsearch-master-0 -- \
  curl -XGET 'localhost:9200/_cat/indices?v'
```

Look for `logstash-*` indices.

#### Verify Fluentd Configuration

```bash
kubectl logs -n logging <fluentd-pod>
```

Check for connection errors to Elasticsearch.

---

## Performance Tuning

### Loki Retention Policy

Configure in `loki-values.yaml`:

```yaml
loki:
  config:
    limits_config:
      retention_period: 744h  # 31 days
    compactor:
      retention_enabled: true
      retention_delete_delay: 2h
```

Apply changes:

```bash
helm upgrade loki grafana/loki-stack \
  --namespace monitoring \
  --values loki-values.yaml
```

### Elasticsearch Index Lifecycle

Create ILM policy:

```bash
kubectl exec -n logging elasticsearch-master-0 -- curl -X PUT \
  "localhost:9200/_ilm/policy/logs-policy" \
  -H 'Content-Type: application/json' \
  -d '{
    "policy": {
      "phases": {
        "hot": {
          "actions": {
            "rollover": {
              "max_age": "7d",
              "max_size": "50gb"
            }
          }
        },
        "delete": {
          "min_age": "30d",
          "actions": {
            "delete": {}
          }
        }
      }
    }
  }'
```

### Promtail Resource Limits

Adjust in `loki-values.yaml`:

```yaml
promtail:
  resources:
    limits:
      cpu: 200m
      memory: 256Mi
    requests:
      cpu: 100m
      memory: 128Mi
```

---

## Security Considerations

### Authentication

#### Grafana Authentication

Configure in Grafana settings:
- Enable OAuth/LDAP for SSO
- Configure role-based access control (RBAC)
- Enforce password complexity requirements

#### Elasticsearch Authentication

Enable X-Pack security:

```yaml
# elasticsearch-values.yaml
xpack:
  security:
    enabled: true
```

Create users:

```bash
kubectl exec -n logging elasticsearch-master-0 -- \
  bin/elasticsearch-users useradd <username> \
  -p <password> -r monitoring
```

### Network Policies

Restrict pod communication:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: loki-network-policy
  namespace: monitoring
spec:
  podSelector:
    matchLabels:
      app: loki
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: grafana
        - podSelector:
            matchLabels:
              app: promtail
      ports:
        - protocol: TCP
          port: 3100
```

### Log Sanitization

Configure Promtail to redact sensitive data:

```yaml
promtail:
  config:
    snippets:
      pipelineStages: |
        - replace:
            expression: '(password=)([^\s]+)'
            replace: '${1}***REDACTED***'
        - replace:
            expression: '(token=)([^\s]+)'
            replace: '${1}***REDACTED***'
```

---

## Monitoring Log System Health

### Loki Metrics

Monitor Loki health via Prometheus:

```promql
# Ingestion rate
rate(loki_distributor_lines_received_total[5m])

# Query performance
histogram_quantile(0.99,
  rate(loki_request_duration_seconds_bucket[5m])
)

# Storage usage
loki_ingester_memory_chunks
```

### Elasticsearch Metrics

Monitor via Elasticsearch APIs:

```bash
# Cluster health
GET /_cluster/health

# Node stats
GET /_nodes/stats

# Index stats
GET /logstash-*/_stats
```

### Alert Rules

Create Prometheus alerts for log system issues:

```yaml
groups:
  - name: logging
    rules:
      - alert: LokiDown
        expr: up{job="loki"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Loki is down"

      - alert: HighLogIngestionRate
        expr: rate(loki_distributor_lines_received_total[5m]) > 10000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High log ingestion rate detected"
```

---

## Best Practices

### Log Structure

1. **Use structured logging** (JSON format)
2. **Include consistent fields**: timestamp, level, message, context
3. **Avoid logging sensitive data**: passwords, tokens, PII
4. **Use appropriate log levels**: DEBUG, INFO, WARN, ERROR, FATAL

Example structured log:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "error",
  "service": "api-gateway",
  "trace_id": "abc123",
  "message": "Database connection failed",
  "error": {
    "type": "ConnectionError",
    "code": "ECONNREFUSED"
  }
}
```

### Resource Planning

- **Elasticsearch**: Allocate 50% of available RAM to heap
- **Loki**: Plan 1GB RAM per 10GB/day log volume
- **Retention**: Balance storage costs with compliance requirements
- **Replication**: Use 2+ replicas for production

### Query Optimization

1. **Use label filtering** before full-text search
2. **Limit time ranges** to necessary periods
3. **Use aggregations** instead of returning all logs
4. **Create saved queries** for common searches

---

## Reference

### Useful Commands

```bash
# Check log volume
kubectl exec -n monitoring loki-0 -- \
  wget -O- http://localhost:3100/loki/api/v1/label/__name__/values

# Tail logs in real-time
kubectl logs -f -n <namespace> <pod-name>

# Export logs for debugging
kubectl logs -n <namespace> <pod-name> --since=1h > app.log

# Check Promtail targets
kubectl port-forward -n monitoring svc/promtail 3101:3101
curl http://localhost:3101/targets
```

### Common Ports

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Loki | 3100 | HTTP | API and ingestion |
| Promtail | 3101 | HTTP | Metrics endpoint |
| Elasticsearch | 9200 | HTTP | API |
| Elasticsearch | 9300 | TCP | Inter-node communication |
| Kibana | 5601 | HTTP | Web UI |

### API Endpoints

#### Loki

- Health: `GET /ready`
- Labels: `GET /loki/api/v1/labels`
- Query: `GET /loki/api/v1/query`
- Query range: `GET /loki/api/v1/query_range`
- Push: `POST /loki/api/v1/push`

#### Elasticsearch

- Cluster health: `GET /_cluster/health`
- Search: `GET /<index>/_search`
- Document: `GET /<index>/_doc/<id>`
- Bulk: `POST /_bulk`

---

## Additional Resources

- Loki Documentation: https://grafana.com/docs/loki/
- Grafana Explore: https://grafana.com/docs/grafana/latest/explore/
- LogQL Reference: https://grafana.com/docs/loki/latest/logql/
- Elasticsearch Documentation: https://www.elastic.co/guide/
- Fluentd Documentation: https://docs.fluentd.org/
- Kibana User Guide: https://www.elastic.co/guide/en/kibana/

---

## Conclusion

This guide covers the fundamental setup and configuration of log aggregation systems integrated with Grafana. Choose the architecture that best fits your requirements:

- **EFK Stack**: For comprehensive log analysis and long-term storage
- **Loki Stack**: For lightweight, cloud-native log aggregation
- **Hybrid**: For enterprise environments requiring both solutions

Ensure proper resource allocation, security configuration, and monitoring of the log infrastructure itself to maintain reliable observability.
