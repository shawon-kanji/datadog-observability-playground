#!/bin/bash

# Create Kubernetes TLS secret from generated certificates
# Run this after generating certificates with generate-tls-cert.sh

set -e

SECRET_NAME="datadog-playground-tls"
NAMESPACE="default"
CERT_FILE="k8/certs/tls.crt"
KEY_FILE="k8/certs/tls.key"

echo "🔑 Creating Kubernetes TLS secret..."

# Check if certificate files exist
if [ ! -f "$CERT_FILE" ]; then
    echo "❌ Error: Certificate file not found: $CERT_FILE"
    echo "   Run: bash k8/scripts/1-generate-tls-cert.sh first"
    exit 1
fi

if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Error: Key file not found: $KEY_FILE"
    echo "   Run: bash k8/scripts/1-generate-tls-cert.sh first"
    exit 1
fi

# Create or update the secret
kubectl create secret tls $SECRET_NAME \
  --cert=$CERT_FILE \
  --key=$KEY_FILE \
  -n $NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✅ TLS secret '$SECRET_NAME' created/updated in namespace '$NAMESPACE'"
echo ""
echo "📝 Verify with: kubectl get secret $SECRET_NAME -n $NAMESPACE"
