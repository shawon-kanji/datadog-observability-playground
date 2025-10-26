#!/bin/bash

# Test script for different scenarios
# Usage: ./test-scenarios.sh [base-url]

BASE_URL=${1:-"http://localhost:3000"}

echo "Testing Datadog CRUD API"
echo "Base URL: $BASE_URL"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to test endpoint
test_endpoint() {
    local scenario=$1
    local endpoint=$2
    local method=${3:-GET}
    local description=$4

    echo -e "${YELLOW}Testing: $description${NC}"
    echo "Scenario: $scenario"
    echo "Endpoint: $method $endpoint"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" "$BASE_URL$endpoint?scenario=$scenario")
    else
        response=$(curl -s -X POST -H "Content-Type: application/json" \
            -d '{"name":"Test Product","price":99.99,"category":"Test","stock":10}' \
            -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
            "$BASE_URL$endpoint?scenario=$scenario")
    fi

    http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)
    time=$(echo "$response" | grep "TIME" | cut -d: -f2)

    echo -e "${GREEN}✓ HTTP $http_code | Time: ${time}s${NC}"
    echo ""
    sleep 1
}

echo "=== 1. Normal Operations ==="
test_endpoint "normal" "/api/products" "GET" "Get all products (normal)"
test_endpoint "normal" "/api/products/1" "GET" "Get product by ID (normal)"

echo "=== 2. Error Scenarios ==="
test_endpoint "error" "/api/products" "GET" "Client error (400)"
test_endpoint "internal-error" "/api/products" "GET" "Internal server error (500)"

echo "=== 3. Latency Scenarios ==="
test_endpoint "long-latency" "/api/products" "GET" "Long latency (5s delay)"
test_endpoint "random-latency" "/api/products" "GET" "Random latency"
test_endpoint "random-latency" "/api/products/2" "GET" "Random latency on single product"

echo "=== 4. Mixed Scenarios ==="
test_endpoint "normal" "/api/products" "POST" "Create product (normal)"
test_endpoint "error" "/api/products" "POST" "Create product (error)"
test_endpoint "long-latency" "/api/products/3" "GET" "Get product with latency"

echo "================================"
echo -e "${GREEN}All tests completed!${NC}"
echo ""
echo "Check your Datadog dashboard for:"
echo "  - APM traces"
echo "  - Error rates"
echo "  - Latency metrics"
echo "  - Log correlation"
