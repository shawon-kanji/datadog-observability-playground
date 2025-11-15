# Helm Charts Complete Guide

## Table of Contents
- [What is Helm?](#what-is-helm)
- [What is a Helm Chart?](#what-is-a-helm-chart)
- [Chart Structure](#chart-structure)
- [Key Files Explained](#key-files-explained)
- [Creating Your First Helm Chart](#creating-your-first-helm-chart)
- [Templates](#templates)
- [Values and Multi-Environment Setup](#values-and-multi-environment-setup)
- [Best Practices](#best-practices)
- [Common Commands](#common-commands)

---

## What is Helm?

**Helm** is the package manager for Kubernetes. Think of it like `npm` for Node.js or `apt` for Ubuntu, but for Kubernetes applications.

### Why Use Helm?
- **Package Management**: Bundle all Kubernetes manifests into a single package
- **Version Control**: Track and rollback deployments easily
- **Templating**: Use variables to customize deployments
- **Reusability**: Share charts across teams and environments
- **Dependency Management**: Manage dependencies between applications

---

## What is a Helm Chart?

A **Helm Chart** is a collection of files that describe a set of Kubernetes resources. It's essentially a package containing:
- Kubernetes manifest templates
- Configuration values
- Metadata about the application
- Dependencies (optional)

**Analogy**: A Helm chart is like a blueprint for building a house. The templates are the blueprint, and values.yaml contains the customizations (paint color, number of rooms, etc.).

---

## Chart Structure

```
my-app-chart/
├── Chart.yaml              # Metadata about the chart
├── values.yaml             # Default configuration values
├── charts/                 # Dependencies (subcharts)
├── templates/              # Kubernetes manifest templates
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── _helpers.tpl       # Template helpers
│   └── NOTES.txt          # Post-install notes
├── .helmignore            # Files to ignore
└── README.md              # Chart documentation
```

---

## Key Files Explained

### 1. **Chart.yaml** - Chart Metadata

This file contains metadata about your chart.

```yaml
apiVersion: v2                    # Chart API version (v2 for Helm 3)
name: my-app                      # Chart name
description: A Helm chart for my application
type: application                 # application or library
version: 1.0.0                    # Chart version (SemVer)
appVersion: "2.1.0"              # Version of the app being deployed

# Optional fields
keywords:
  - web
  - nodejs
  - microservice
home: https://example.com
sources:
  - https://github.com/myorg/myapp
maintainers:
  - name: John Doe
    email: john@example.com
dependencies:
  - name: postgresql
    version: 12.1.0
    repository: https://charts.bitnami.com/bitnami
```

**Key Fields:**
- `version`: Chart version (increments when chart changes)
- `appVersion`: Application version (increments when app changes)
- `dependencies`: External charts this chart depends on

---

### 2. **values.yaml** - Default Configuration

This file contains default configuration values that can be overridden.

```yaml
# Image configuration
image:
  repository: myorg/myapp
  tag: "1.0.0"
  pullPolicy: IfNotPresent

# Replica count
replicaCount: 2

# Service configuration
service:
  type: ClusterIP
  port: 80
  targetPort: 8080

# Ingress configuration
ingress:
  enabled: false
  className: nginx
  annotations: {}
  hosts:
    - host: myapp.example.com
      paths:
        - path: /
          pathType: Prefix

# Resource limits
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

# Environment variables
env:
  - name: NODE_ENV
    value: production
  - name: LOG_LEVEL
    value: info

# ConfigMap data
config:
  database:
    host: postgres.default.svc.cluster.local
    port: 5432
  cache:
    ttl: 3600
```

---

### 3. **templates/** - Kubernetes Manifest Templates

Templates are Kubernetes manifests with Go template syntax for dynamic values.

#### **templates/deployment.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "my-app.fullname" . }}
  labels:
    {{- include "my-app.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "my-app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "my-app.selectorLabels" . | nindent 8 }}
    spec:
      containers:
      - name: {{ .Chart.Name }}
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        ports:
        - name: http
          containerPort: {{ .Values.service.targetPort }}
          protocol: TCP
        env:
        {{- range .Values.env }}
        - name: {{ .name }}
          value: {{ .value | quote }}
        {{- end }}
        resources:
          {{- toYaml .Values.resources | nindent 10 }}
```

#### **templates/service.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "my-app.fullname" . }}
  labels:
    {{- include "my-app.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "my-app.selectorLabels" . | nindent 4 }}
```

#### **templates/_helpers.tpl**

Template helpers for reusable template snippets:

```yaml
{{/*
Expand the name of the chart.
*/}}
{{- define "my-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "my-app.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "my-app.labels" -}}
helm.sh/chart: {{ include "my-app.chart" . }}
{{ include "my-app.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "my-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "my-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
```

---

## Creating Your First Helm Chart

### Step 1: Create a New Chart

```bash
# Create chart structure
helm create my-app

# This creates:
# my-app/
#   Chart.yaml
#   values.yaml
#   charts/
#   templates/
```

### Step 2: Customize Chart.yaml

```bash
cd my-app
```

Edit `Chart.yaml`:

```yaml
apiVersion: v2
name: my-app
description: My awesome application
type: application
version: 0.1.0
appVersion: "1.0.0"
```

### Step 3: Customize values.yaml

```yaml
replicaCount: 2

image:
  repository: nginx
  tag: "1.21"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
```

### Step 4: Validate the Chart

```bash
# Lint the chart
helm lint .

# Dry-run to see generated manifests
helm install --dry-run --debug my-app .

# Template rendering (no cluster needed)
helm template my-app .
```

### Step 5: Install the Chart

```bash
# Install to Kubernetes
helm install my-app .

# Install with custom release name
helm install my-release-name ./my-app

# Install with custom values
helm install my-app . -f custom-values.yaml
```

---

## Templates

Templates use **Go template syntax** with Helm-specific functions.

### Template Syntax Basics

```yaml
# Access values
{{ .Values.replicaCount }}

# Access chart metadata
{{ .Chart.Name }}
{{ .Chart.Version }}

# Access release information
{{ .Release.Name }}
{{ .Release.Namespace }}

# Default values
{{ .Values.image.tag | default "latest" }}

# Conditionals
{{- if .Values.ingress.enabled }}
# ingress configuration
{{- end }}

# Loops
{{- range .Values.env }}
- name: {{ .name }}
  value: {{ .value }}
{{- end }}

# Include templates
{{ include "my-app.fullname" . }}

# Quote strings
{{ .Values.name | quote }}

# Convert to YAML
{{- toYaml .Values.resources | nindent 10 }}

# Trim whitespace (- removes newlines)
{{- if .Values.something }}
```

### Common Template Functions

```yaml
# String operations
{{ .Values.name | upper }}
{{ .Values.name | lower }}
{{ .Values.name | title }}
{{ .Values.name | quote }}
{{ .Values.name | trunc 63 }}

# Default values
{{ .Values.port | default 8080 }}

# Type conversion
{{ .Values.enabled | toString }}
{{ .Values.count | int }}

# YAML/JSON
{{ toYaml .Values.labels | nindent 4 }}
{{ toJson .Values.config }}

# Base64 encoding
{{ .Values.secret | b64enc }}
{{ .Values.encoded | b64dec }}
```

---

## Values and Multi-Environment Setup

### Strategy 1: Separate Values Files

Create environment-specific values files:

```
my-app/
├── values.yaml              # Base/default values
├── values-dev.yaml          # Development overrides
├── values-staging.yaml      # Staging overrides
└── values-prod.yaml         # Production overrides
```

#### **values.yaml** (Base/Defaults)

```yaml
# Common configuration across all environments
image:
  repository: myorg/myapp
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi
```

#### **values-dev.yaml** (Development)

```yaml
# Development-specific overrides
replicaCount: 1

image:
  tag: "dev-latest"
  pullPolicy: Always

ingress:
  enabled: true
  hosts:
    - host: myapp-dev.example.com
      paths:
        - path: /
          pathType: Prefix

env:
  - name: NODE_ENV
    value: development
  - name: LOG_LEVEL
    value: debug
  - name: DATABASE_HOST
    value: postgres-dev.example.com

resources:
  limits:
    cpu: 250m
    memory: 256Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: false
```

#### **values-staging.yaml** (Staging)

```yaml
# Staging-specific overrides
replicaCount: 2

image:
  tag: "1.0.0-rc.1"
  pullPolicy: IfNotPresent

ingress:
  enabled: true
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-staging
  hosts:
    - host: myapp-staging.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: myapp-staging-tls
      hosts:
        - myapp-staging.example.com

env:
  - name: NODE_ENV
    value: staging
  - name: LOG_LEVEL
    value: info
  - name: DATABASE_HOST
    value: postgres-staging.example.com

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5
  targetCPUUtilizationPercentage: 70
```

#### **values-prod.yaml** (Production)

```yaml
# Production-specific overrides
replicaCount: 3

image:
  tag: "1.0.0"
  pullPolicy: IfNotPresent

ingress:
  enabled: true
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
  hosts:
    - host: myapp.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: myapp-prod-tls
      hosts:
        - myapp.example.com

env:
  - name: NODE_ENV
    value: production
  - name: LOG_LEVEL
    value: warn
  - name: DATABASE_HOST
    value: postgres-prod.example.com

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 60

podDisruptionBudget:
  enabled: true
  minAvailable: 2
```

### Deploying to Different Environments

```bash
# Development
helm install my-app . -f values.yaml -f values-dev.yaml -n dev

# Staging
helm install my-app . -f values.yaml -f values-staging.yaml -n staging

# Production
helm install my-app . -f values.yaml -f values-prod.yaml -n production

# Or use --set for individual overrides
helm install my-app . \
  -f values-prod.yaml \
  --set image.tag=1.0.1 \
  --set replicaCount=5
```

### Strategy 2: Using Namespaces and Context

```bash
# Create namespaces
kubectl create namespace dev
kubectl create namespace staging
kubectl create namespace production

# Deploy to different namespaces
helm install my-app . -f values-dev.yaml --namespace dev
helm install my-app . -f values-staging.yaml --namespace staging
helm install my-app . -f values-prod.yaml --namespace production
```

### Strategy 3: Environment Variable in Templates

You can also check for environment in templates:

```yaml
# values.yaml
global:
  environment: production

# deployment.yaml
{{- if eq .Values.global.environment "production" }}
replicas: 5
{{- else if eq .Values.global.environment "staging" }}
replicas: 3
{{- else }}
replicas: 1
{{- end }}
```

---

## Best Practices

### 1. Version Management

```yaml
# Chart.yaml
version: 1.2.3      # Increment when chart changes
appVersion: "2.0.0" # Increment when app changes
```

**Versioning Rules:**
- **MAJOR**: Incompatible API changes
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

### 2. Resource Limits

Always define resource limits in values.yaml:

```yaml
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi
```

### 3. Use _helpers.tpl

Create reusable template snippets:

```yaml
{{- define "my-app.fullname" -}}
{{ .Release.Name }}-{{ .Chart.Name }}
{{- end }}
```

### 4. Secrets Management

Don't store secrets in values.yaml. Use:

```yaml
# Use Kubernetes secrets
env:
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: db-secret
        key: password

# Or use external secrets operator
# Or use sealed secrets
# Or use HashiCorp Vault
```

### 5. Documentation

Add NOTES.txt for post-install instructions:

```yaml
# templates/NOTES.txt
Thank you for installing {{ .Chart.Name }}.

Your release is named {{ .Release.Name }}.

To access your application:

{{- if .Values.ingress.enabled }}
  http{{ if .Values.ingress.tls }}s{{ end }}://{{ .Values.ingress.hosts.0.host }}
{{- else }}
  kubectl port-forward svc/{{ include "my-app.fullname" . }} 8080:{{ .Values.service.port }}
{{- end }}
```

### 6. Testing

```bash
# Lint the chart
helm lint ./my-app

# Test template rendering
helm template my-app ./my-app

# Dry run
helm install my-app ./my-app --dry-run --debug

# Unit testing with helm unittest plugin
helm unittest ./my-app
```

---

## Common Commands

### Chart Management

```bash
# Create new chart
helm create my-app

# Lint chart
helm lint ./my-app

# Package chart
helm package ./my-app

# Show chart values
helm show values ./my-app

# Show chart definition
helm show chart ./my-app

# Show all chart info
helm show all ./my-app
```

### Installation & Upgrades

```bash
# Install chart
helm install my-release ./my-app

# Install with custom values
helm install my-release ./my-app -f custom-values.yaml

# Install with inline values
helm install my-release ./my-app --set replicaCount=3

# Install to specific namespace
helm install my-release ./my-app -n production

# Upgrade release
helm upgrade my-release ./my-app

# Upgrade or install (if not exists)
helm upgrade --install my-release ./my-app

# Upgrade with new values
helm upgrade my-release ./my-app -f new-values.yaml

# Force upgrade
helm upgrade my-release ./my-app --force

# Rollback to previous version
helm rollback my-release

# Rollback to specific revision
helm rollback my-release 2
```

### Release Management

```bash
# List releases
helm list
helm list --all-namespaces
helm list -n production

# Get release status
helm status my-release

# Get release history
helm history my-release

# Get release values
helm get values my-release

# Get release manifest
helm get manifest my-release

# Uninstall release
helm uninstall my-release

# Uninstall but keep history
helm uninstall my-release --keep-history
```

### Template & Debug

```bash
# Render templates locally
helm template my-release ./my-app

# Render with custom values
helm template my-release ./my-app -f values-prod.yaml

# Debug installation
helm install my-release ./my-app --dry-run --debug

# Validate manifests
helm template my-release ./my-app | kubectl apply --dry-run=client -f -
```

### Repository Management

```bash
# Add repository
helm repo add bitnami https://charts.bitnami.com/bitnami

# Update repositories
helm repo update

# Search repositories
helm search repo nginx

# Remove repository
helm repo remove bitnami

# List repositories
helm repo list
```

---

## Complete Example: Multi-Environment Deployment

### Directory Structure

```
my-microservice/
├── Chart.yaml
├── values.yaml
├── values-dev.yaml
├── values-staging.yaml
├── values-prod.yaml
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    ├── ingress.yaml
    ├── configmap.yaml
    ├── hpa.yaml
    ├── _helpers.tpl
    └── NOTES.txt
```

### Deployment Script

```bash
#!/bin/bash

ENVIRONMENT=$1
NAMESPACE=$2
RELEASE_NAME="my-app"

if [ -z "$ENVIRONMENT" ] || [ -z "$NAMESPACE" ]; then
  echo "Usage: ./deploy.sh <environment> <namespace>"
  echo "Example: ./deploy.sh dev development"
  exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
  echo "Invalid environment. Must be: dev, staging, or prod"
  exit 1
fi

# Create namespace if it doesn't exist
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Deploy
echo "Deploying to $ENVIRONMENT environment in namespace $NAMESPACE..."
helm upgrade --install $RELEASE_NAME . \
  -f values.yaml \
  -f values-$ENVIRONMENT.yaml \
  --namespace $NAMESPACE \
  --wait \
  --timeout 5m

echo "Deployment complete!"
helm status $RELEASE_NAME -n $NAMESPACE
```

### Usage

```bash
# Deploy to development
./deploy.sh dev development

# Deploy to staging
./deploy.sh staging staging

# Deploy to production
./deploy.sh prod production
```

---

## Advanced Topics

### 1. Dependencies (Subcharts)

```yaml
# Chart.yaml
dependencies:
  - name: postgresql
    version: 12.1.0
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: 17.3.0
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

Install dependencies:

```bash
helm dependency update
helm dependency build
```

### 2. Hooks

Execute actions at specific points in the release lifecycle:

```yaml
# templates/pre-install-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "my-app.fullname" . }}-migration
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "0"
    "helm.sh/hook-delete-policy": hook-succeeded
spec:
  template:
    spec:
      containers:
      - name: migration
        image: {{ .Values.image.repository }}:{{ .Values.image.tag }}
        command: ["npm", "run", "migrate"]
      restartPolicy: Never
```

### 3. Chart Testing

```yaml
# templates/tests/test-connection.yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "my-app.fullname" . }}-test-connection"
  annotations:
    "helm.sh/hook": test
spec:
  containers:
  - name: wget
    image: busybox
    command: ['wget']
    args: ['{{ include "my-app.fullname" . }}:{{ .Values.service.port }}']
  restartPolicy: Never
```

Run tests:

```bash
helm test my-release
```

---

## Troubleshooting

### Common Issues

```bash
# Chart fails to install
helm install my-app . --dry-run --debug

# Check rendered templates
helm template my-app .

# Validate YAML syntax
helm lint .

# Check actual deployed manifests
helm get manifest my-release

# Check values being used
helm get values my-release

# View release history
helm history my-release

# Check logs
kubectl logs -l app.kubernetes.io/instance=my-release
```

---

## Summary

**Key Takeaways:**

1. **Helm Chart** = Package of Kubernetes resources
2. **Chart.yaml** = Metadata about the chart
3. **values.yaml** = Configuration values (can be overridden)
4. **templates/** = Kubernetes manifests with Go templates
5. **Multi-environment** = Use separate values files (values-dev.yaml, values-prod.yaml)

**Workflow:**
1. Create chart: `helm create my-app`
2. Customize templates and values
3. Test: `helm lint` and `helm template`
4. Install: `helm install my-app . -f values-prod.yaml`
5. Update: `helm upgrade my-app .`
6. Rollback if needed: `helm rollback my-app`

**For Multiple Environments:**
- Maintain base `values.yaml`
- Create `values-{env}.yaml` for each environment
- Deploy with: `helm install my-app . -f values.yaml -f values-prod.yaml`

---

## Additional Resources

- Official Helm Documentation: https://helm.sh/docs/
- Helm Hub (Chart Repository): https://artifacthub.io/
- Best Practices: https://helm.sh/docs/chart_best_practices/
- Template Functions: https://helm.sh/docs/chart_template_guide/function_list/
