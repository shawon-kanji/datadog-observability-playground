#!/bin/bash

# Generate self-signed TLS certificate for local Kubernetes ingress
# Domain: datadog-playground.local

set -e

DOMAIN="datadog-playground.local"
CERT_DIR="k8/certs"
DAYS_VALID=365

echo "🔐 Generating self-signed TLS certificate for ${DOMAIN}..."

# Generate private key
openssl genrsa -out "${CERT_DIR}/tls.key" 2048

# Generate certificate signing request (CSR)
openssl req -new -key "${CERT_DIR}/tls.key" -out "${CERT_DIR}/tls.csr" -subj "/CN=${DOMAIN}/O=Datadog Playground"

# Generate self-signed certificate
openssl x509 -req -days ${DAYS_VALID} \
  -in "${CERT_DIR}/tls.csr" \
  -signkey "${CERT_DIR}/tls.key" \
  -out "${CERT_DIR}/tls.crt" \
  -extfile <(printf "subjectAltName=DNS:${DOMAIN},DNS:*.${DOMAIN}")

echo "✅ Certificate generated successfully!"
echo "   - Private key: ${CERT_DIR}/tls.key"
echo "   - Certificate: ${CERT_DIR}/tls.crt"
echo ""
echo "📝 Next steps:"
echo "   1. Create Kubernetes TLS secret: bash k8/scripts/2-create-tls-secret.sh"
echo "   2. Apply ingress config: kubectl apply -f k8/definations/ingress.yaml"
echo "   3. Update /etc/hosts: sudo bash k8/scripts/3-update-hosts.sh"
echo "   4. Access: https://${DOMAIN}:30444 (ingress) or http://localhost:30080 (direct frontend)"

# Verify certificate
echo ""
echo "📋 Certificate details:"
openssl x509 -in "${CERT_DIR}/tls.crt" -noout -subject -dates
