# Docker Compose Guide

## 🚀 Quick Start with Docker Compose

### Option 1: Development (Recommended for Testing)

Use the simplified development setup without Datadog:

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up --build

# Or run in detached mode
docker-compose -f docker-compose.dev.yml up -d --build
```

**Access Points:**
- Frontend: http://localhost:8080
- Product API: http://localhost:3000
- User API: http://localhost:3002
- Order API: http://localhost:3001
- MongoDB: localhost:27017

### Option 2: Full Stack with Datadog

Requires Datadog API key:

```bash
# Set your Datadog API key
export DD_API_KEY=your-datadog-api-key

# Start all services including Datadog Agent
docker-compose up --build -d
```

---

## 📋 Initial Setup

### 1. Build Images

```bash
# Development setup
docker-compose -f docker-compose.dev.yml build

# Or with Datadog
docker-compose build
```

### 2. Seed the Database

After services are running, seed the product database:

```bash
# Enter the product-service container
docker exec -it product-service-dev sh

# Run seed script
pnpm seed

# Exit container
exit
```

Or run it directly:
```bash
docker exec -it product-service-dev pnpm seed
```

### 3. Create Admin User (Optional)

```bash
# Connect to MongoDB
docker exec -it mongodb-dev mongosh mongodb://localhost:27017/user-service

# In MongoDB shell, create admin user
db.users.insertOne({
  email: "admin@test.com",
  // This is bcrypt hash of "password123"
  password: "$2a$10$YQ7eZ9Z.O9rJ.XqJ.9Z.O9rJ.XqJ.9Z.O9rJ.XqJ.9Z.O",
  firstName: "Admin",
  lastName: "User",
  role: "ADMIN",
  createdAt: new Date(),
  updatedAt: new Date()
})

exit
```

---

## 🛠️ Common Commands

### Start Services
```bash
# Development
docker-compose -f docker-compose.dev.yml up -d

# With Datadog
docker-compose up -d
```

### Stop Services
```bash
# Development
docker-compose -f docker-compose.dev.yml down

# With Datadog
docker-compose down
```

### Stop and Remove Volumes (Clean Start)
```bash
# Development
docker-compose -f docker-compose.dev.yml down -v

# With Datadog
docker-compose down -v
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f product-service
docker-compose -f docker-compose.dev.yml logs -f user-service
docker-compose -f docker-compose.dev.yml logs -f order-service
docker-compose -f docker-compose.dev.yml logs -f frontend
```

### Restart a Service
```bash
docker-compose -f docker-compose.dev.yml restart product-service
```

### Check Service Status
```bash
docker-compose -f docker-compose.dev.yml ps
```

---

## 🔍 Accessing Services

### MongoDB
```bash
# Using Docker
docker exec -it mongodb-dev mongosh

# From host (if MongoDB client installed)
mongosh mongodb://localhost:27017

# View databases
show dbs
use product-service
show collections
```

### Service Containers
```bash
# Product Service
docker exec -it product-service-dev sh

# User Service
docker exec -it user-service-dev sh

# Order Service
docker exec -it order-service-dev sh
```

---

## 🧪 Testing APIs

### Register User
```bash
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "role": "MERCHANT"
  }'
```

### Login
```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### List Products
```bash
curl http://localhost:3000/api/products
```

### Create Product (with auth token)
```bash
TOKEN="your-jwt-token-here"

curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "description": "A test product",
    "price": 99.99,
    "category": "Electronics",
    "stock": 50,
    "imageUrl": "https://example.com/image.jpg",
    "brand": "TestBrand"
  }'
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process using port
lsof -ti:3000
lsof -ti:3001
lsof -ti:3002

# Kill process
lsof -ti:3000 | xargs kill -9
```

### MongoDB Connection Issues
```bash
# Check MongoDB logs
docker logs mongodb-dev

# Restart MongoDB
docker-compose -f docker-compose.dev.yml restart mongodb

# Check MongoDB is healthy
docker-compose -f docker-compose.dev.yml ps
```

### Service Won't Start
```bash
# Check logs for errors
docker-compose -f docker-compose.dev.yml logs service-name

# Rebuild specific service
docker-compose -f docker-compose.dev.yml build --no-cache service-name

# Remove all containers and start fresh
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up --build
```

### Database is Empty
```bash
# Make sure to seed the database
docker exec -it product-service-dev pnpm seed
```

---

## 📊 Service Health Checks

Check if services are healthy:

```bash
# Product Service
curl http://localhost:3000/health

# User Service
curl http://localhost:3002/health

# Order Service
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "product-service",
  "version": "1.0.0",
  "database": "connected"
}
```

---

## 🔄 Update Code and Rebuild

After making code changes:

```bash
# Rebuild specific service
docker-compose -f docker-compose.dev.yml build product-service

# Restart the service
docker-compose -f docker-compose.dev.yml up -d product-service

# Or rebuild and restart everything
docker-compose -f docker-compose.dev.yml up --build -d
```

---

## 📝 Environment Variables

Create a `.env` file in the root directory:

```env
# JWT Secret (same for all services)
JWT_SECRET=your-secret-key-for-development

# Datadog (only for docker-compose.yml)
DD_API_KEY=your-datadog-api-key
```

---

## 🎯 Complete Testing Flow

```bash
# 1. Start services
docker-compose -f docker-compose.dev.yml up -d

# 2. Wait for services to be healthy
sleep 10

# 3. Seed products
docker exec -it product-service-dev pnpm seed

# 4. Register a merchant user
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"merchant@test.com","password":"password123","firstName":"Merchant","lastName":"User","role":"MERCHANT"}'

# 5. Login and get token
TOKEN=$(curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"merchant@test.com","password":"password123"}' \
  | jq -r '.data.token')

# 6. Create a product
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Product",
    "description": "A great product",
    "price": 149.99,
    "category": "Electronics",
    "stock": 100,
    "imageUrl": "https://example.com/product.jpg",
    "brand": "MyBrand"
  }'

# 7. View all products
curl http://localhost:3000/api/products

# 8. Open browser to frontend
open http://localhost:8080
```

---

## 🚦 Next Steps

1. ✅ Services running
2. ✅ Database seeded
3. ✅ User registered
4. ✅ Products available
5. 🎉 Ready to test!

Visit http://localhost:8080 to use the frontend UI!
