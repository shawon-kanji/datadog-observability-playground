# API Reference

Complete reference for all API endpoints in the Datadog Observability Playground.

## Base URL

**Local Development**: `http://localhost:3000`
**AWS Deployment**: `http://<ALB_DNS_NAME>` (from CDK output)

## Health Check

### GET /health

Check if the application is running and healthy.

**Request**:
```bash
curl http://localhost:3000/health
```

**Response** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2025-10-29T10:30:00.000Z",
  "uptime": 123.45,
  "service": "test-datadog-crud-api",
  "environment": "local"
}
```

## Products API

All product endpoints support scenario simulation via the `scenario` query parameter.

### Get All Products

Retrieve all products in the catalog.

**Endpoint**: `GET /api/products`

**Query Parameters**:
- `scenario` (optional): Simulation scenario (see [Scenarios](#scenarios))

**Request**:
```bash
curl http://localhost:3000/api/products
```

**Response** (200 OK):
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 1,
      "name": "Laptop",
      "price": 999.99,
      "category": "Electronics",
      "stock": 50
    },
    {
      "id": 2,
      "name": "Phone",
      "price": 699.99,
      "category": "Electronics",
      "stock": 100
    }
  ]
}
```

### Get Product by ID

Retrieve a single product by its ID.

**Endpoint**: `GET /api/products/:id`

**Path Parameters**:
- `id` (required): Product ID (integer)

**Query Parameters**:
- `scenario` (optional): Simulation scenario

**Request**:
```bash
curl http://localhost:3000/api/products/1
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Laptop",
    "price": 999.99,
    "category": "Electronics",
    "stock": 50
  }
}
```

**Response** (404 Not Found):
```json
{
  "success": false,
  "error": "Product not found"
}
```

### Create Product

Add a new product to the catalog.

**Endpoint**: `POST /api/products`

**Headers**:
- `Content-Type: application/json`

**Request Body**:
```json
{
  "name": "New Laptop",
  "price": 1299.99,
  "category": "Electronics",
  "stock": 25
}
```

**Required Fields**:
- `name` (string): Product name
- `price` (number): Product price (must be > 0)
- `category` (string): Product category
- `stock` (number): Stock quantity (must be >= 0)

**Request**:
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Laptop",
    "price": 1299.99,
    "category": "Electronics",
    "stock": 25
  }'
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": 6,
    "name": "New Laptop",
    "price": 1299.99,
    "category": "Electronics",
    "stock": 25
  }
}
```

**Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "Validation error: price must be greater than 0"
}
```

### Update Product

Update an existing product.

**Endpoint**: `PUT /api/products/:id`

**Path Parameters**:
- `id` (required): Product ID (integer)

**Headers**:
- `Content-Type: application/json`

**Request Body** (all fields optional):
```json
{
  "name": "Updated Laptop",
  "price": 899.99,
  "stock": 40
}
```

**Request**:
```bash
curl -X PUT http://localhost:3000/api/products/1 \
  -H "Content-Type: application/json" \
  -d '{
    "price": 899.99,
    "stock": 40
  }'
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Laptop",
    "price": 899.99,
    "category": "Electronics",
    "stock": 40
  }
}
```

**Response** (404 Not Found):
```json
{
  "success": false,
  "error": "Product not found"
}
```

### Delete Product

Remove a product from the catalog.

**Endpoint**: `DELETE /api/products/:id`

**Path Parameters**:
- `id` (required): Product ID (integer)

**Request**:
```bash
curl -X DELETE http://localhost:3000/api/products/1
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

**Response** (404 Not Found):
```json
{
  "success": false,
  "error": "Product not found"
}
```

## Scenarios

Add `?scenario=<type>` to any `/api/*` endpoint to simulate different application states.

### Available Scenarios

| Scenario | HTTP Status | Delay | Description |
|----------|------------|-------|-------------|
| `normal` | 200 | 0ms | No delay (default) |
| `error` | 400 | 0ms | Client error - Bad Request |
| `internal-error` | 500 | 0ms | Server error - Internal Server Error |
| `long-latency` | 200 | 5000ms | Fixed 5-second delay |
| `random-latency` | 200 | 100-3000ms | Random delay between 100ms and 3s |
| `timeout` | 200 | 30000ms | Very long 30-second delay |

### Scenario Examples

**Trigger Client Error (400)**:
```bash
curl http://localhost:3000/api/products?scenario=error
```

Response:
```json
{
  "success": false,
  "error": "Simulated client error"
}
```

**Trigger Server Error (500)**:
```bash
curl http://localhost:3000/api/products?scenario=internal-error
```

Response:
```json
{
  "success": false,
  "error": "Simulated internal server error"
}
```

**Test Long Latency**:
```bash
time curl http://localhost:3000/api/products?scenario=long-latency
# Will take exactly 5 seconds
```

**Test Random Latency**:
```bash
curl http://localhost:3000/api/products?scenario=random-latency
# Will take between 100ms and 3 seconds
```

**Test Timeout**:
```bash
curl http://localhost:3000/api/products?scenario=timeout
# Will take 30 seconds (useful for testing timeout handling)
```

## Using Scenarios with Different Methods

Scenarios work with all HTTP methods:

```bash
# GET with scenario
curl http://localhost:3000/api/products/1?scenario=long-latency

# POST with scenario
curl -X POST http://localhost:3000/api/products?scenario=random-latency \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","price":99.99,"category":"Test","stock":10}'

# PUT with scenario
curl -X PUT http://localhost:3000/api/products/1?scenario=error \
  -H "Content-Type: application/json" \
  -d '{"price":149.99}'

# DELETE with scenario
curl -X DELETE http://localhost:3000/api/products/1?scenario=internal-error
```

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- `200 OK`: Successful GET, PUT, DELETE
- `201 Created`: Successful POST
- `400 Bad Request`: Invalid input, validation error
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side error

## Default Products

The application comes with 5 pre-populated products:

1. **Laptop** - Electronics - $999.99
2. **Phone** - Electronics - $699.99
3. **Desk Chair** - Furniture - $299.99
4. **Monitor** - Electronics - $449.99
5. **Keyboard** - Electronics - $129.99

**Note**: Data is stored in memory and resets when the application restarts.

## Testing the API

See the [Testing Guide](./testing.md) for comprehensive testing examples and load generation scripts.

## Integration with Datadog

All API calls are automatically traced and logged:

- **Traces**: View in APM → Services → `test-datadog-crud-api`
- **Logs**: Filter by `service:test-datadog-crud-api` in Logs explorer
- **Metrics**: Automatic runtime and custom metrics

Learn more in the [Monitoring Guide](./monitoring.md).
