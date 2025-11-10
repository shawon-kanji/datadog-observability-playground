#!/bin/bash

# Setup metrics-server for Horizontal Pod Autoscaler (HPA)
# Required for HPA to work

set -e

echo "📊 Setting up metrics-server for HPA..."

# Check if metrics-server is already installed
if kubectl get deployment -n kube-system metrics-server &>/dev/null; then
    echo "⚠️  metrics-server is already installed"
    kubectl get deployment -n kube-system metrics-server
    exit 0
fi

# Install metrics-server with Docker Desktop specific configuration
echo "📥 Installing metrics-server..."
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Wait for deployment to be created
echo "⏳ Waiting for metrics-server deployment..."
sleep 5

# Patch metrics-server for Docker Desktop (disable TLS verification)
echo "🔧 Patching metrics-server for Docker Desktop..."
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[
    {
      "op": "add",
      "path": "/spec/template/spec/containers/0/args/-",
      "value": "--kubelet-insecure-tls"
    }
  ]'

# Wait for metrics-server to be ready
echo "⏳ Waiting for metrics-server to be ready..."
kubectl wait --for=condition=available --timeout=120s deployment/metrics-server -n kube-system

echo ""
echo "✅ metrics-server installed successfully!"
echo ""
echo "📋 Verify installation:"
echo "   kubectl get deployment -n kube-system metrics-server"
echo "   kubectl top nodes"
echo "   kubectl top pods"
echo ""
echo "📝 Next steps:"
echo "   1. Ensure your deployment has resource requests defined"
echo "   2. Apply HPA: kubectl apply -f k8/definations/app-hpa.yaml"
echo "   3. Check HPA status: kubectl get hpa"
echo "   4. Test autoscaling: Use load testing tools"
