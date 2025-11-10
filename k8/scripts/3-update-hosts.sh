#!/bin/bash

# Update /etc/hosts to add custom domain for local Kubernetes cluster
# This script must be run with sudo

set -e

DOMAIN="datadog-playground.local"
IP="127.0.0.1"
HOSTS_FILE="/etc/hosts"
MARKER="# Datadog Playground Local K8s"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run with sudo"
    echo "   Usage: sudo bash k8/scripts/3-update-hosts.sh"
    exit 1
fi

echo "🔧 Updating /etc/hosts file..."

# Check if entry already exists
if grep -q "$DOMAIN" "$HOSTS_FILE"; then
    echo "⚠️  Entry for $DOMAIN already exists in $HOSTS_FILE"
    echo "   Current entry:"
    grep "$DOMAIN" "$HOSTS_FILE"
    echo ""
    read -p "Do you want to update it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted"
        exit 1
    fi

    # Remove old entry
    sed -i '' "/$DOMAIN/d" "$HOSTS_FILE"
    echo "🗑️  Removed old entry"
fi

# Add new entry
echo "$IP $DOMAIN $MARKER" >> "$HOSTS_FILE"

echo "✅ Successfully added $DOMAIN to $HOSTS_FILE"
echo ""
echo "📋 New entry:"
grep "$DOMAIN" "$HOSTS_FILE"
echo ""
echo "🧪 Test with: ping $DOMAIN"
echo "🌐 Access options:"
echo "   - Ingress (HTTPS): https://$DOMAIN:30444"
echo "   - Ingress (HTTP):  http://$DOMAIN:30081"
echo "   - Direct Frontend: http://localhost:30080"
echo ""
echo "ℹ️  To remove later, run:"
echo "   sudo sed -i '' '/$DOMAIN/d' $HOSTS_FILE"
