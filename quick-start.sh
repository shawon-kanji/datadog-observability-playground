#!/bin/bash

# Quick Start Script for Datadog Observability Playground
# This script helps you quickly test all the features

set -e

echo "🚀 Datadog Observability Playground - Quick Start"
echo "=================================================="
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install it first:"
    echo "   npm install -g pnpm"
    exit 1
fi

# Check if MongoDB is running
if ! nc -z localhost 27017 2>/dev/null; then
    echo "⚠️  MongoDB is not running on localhost:27017"
    echo ""
    echo "Starting MongoDB with Docker..."
    docker run -d \
      --name mongodb \
      -p 27017:27017 \
      -v mongodb-data:/data/db \
      mongo:7 || echo "MongoDB container might already exist"

    echo "Waiting for MongoDB to start..."
    sleep 5
fi

echo "✅ MongoDB is running"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --silent
echo "✅ Dependencies installed"
echo ""

# Seed database
echo "🌱 Seeding database with sample products..."
cd packages/app
pnpm seed
cd ../..
echo "✅ Database seeded with 10 products"
echo ""

echo "🎉 Setup Complete!"
echo ""
echo "Next steps:"
echo "==========="
echo ""
echo "1. Start services in separate terminals:"
echo ""
echo "   Terminal 1 - User Service:"
echo "   $ cd packages/user-service && pnpm dev"
echo ""
echo "   Terminal 2 - Product Service:"
echo "   $ cd packages/app && pnpm dev"
echo ""
echo "   Terminal 3 - Order Service:"
echo "   $ cd packages/order-service && pnpm dev"
echo ""
echo "   Terminal 4 - Frontend:"
echo "   $ cd packages/frontend && pnpm dev"
echo ""
echo "2. Open browser: http://localhost:5173"
echo ""
echo "3. Test APIs (see TESTING_GUIDE.md for details):"
echo "   - Register: POST http://localhost:3002/api/auth/register"
echo "   - Products: GET http://localhost:3000/api/products"
echo ""
echo "📖 Read TESTING_GUIDE.md for complete testing instructions"
echo ""
