# Testing Guide - Datadog Observability Playground

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install all dependencies
pnpm install

# Or install for specific services
pnpm --filter app install
pnpm --filter user-service install
pnpm --filter order-service install
pnpm --filter frontend install
```

### 2. Start MongoDB (Required)

Using Docker:
```bash
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb-data:/data/db \
  mongo:7
```

Or if using Kubernetes (from project root):
```bash
kubectl apply -f k8/mongo-pvc.yaml
kubectl apply -f k8/mongo-deployment.yaml
kubectl apply -f k8/mongo-service.yaml
```

### 3. Seed the Database

```bash
# Seed products (10 sample products with images)
pnpm --filter app seed

# Expected output:
# Successfully seeded 10 products
#   - Apple MacBook Pro 16" ($2499.99) - 15 in stock
#   - Sony WH-1000XM5 Wireless Headphones ($399.99) - 45 in stock
#   ...
```

### 4. Start Services

#### Option A: Local Development (Recommended for testing)

Terminal 1 - User Service (Port 3002):
```bash
cd packages/user-service
MONGODB_URI=mongodb://localhost:27017/user-service pnpm dev
```

Terminal 2 - Product Service (Port 3000):
```bash
cd packages/app
MONGODB_URI=mongodb://localhost:27017/product-service pnpm dev
```

Terminal 3 - Order Service (Port 3001):
```bash
cd packages/order-service
MONGODB_URI=mongodb://localhost:27017/order-service pnpm dev
```

Terminal 4 - Frontend (Port 5173):
```bash
cd packages/frontend
pnpm dev
```

#### Option B: Kubernetes

```bash
# Apply all configurations
kubectl apply -f k8/

# Check pod status
kubectl get pods

# Check services
kubectl get svc
```

---

## 🧪 API Testing Guide

### 1. User Registration & Authentication

#### Register as Regular User
```bash
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "...",
      "email": "user@test.com",
      "firstName": "Test",
      "lastName": "User",
      "role": "USER"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### Register as Merchant
```bash
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@test.com",
    "password": "password123",
    "firstName": "Merchant",
    "lastName": "User",
    "role": "MERCHANT"
  }'
```

#### Login
```bash
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@test.com",
    "password": "password123"
  }'
```

**Save the token from response:**
```bash
export TOKEN="your-token-here"
```

---

### 2. Product Management

#### List All Products (Public)
```bash
curl http://localhost:3000/api/products
```

#### Get Single Product
```bash
curl http://localhost:3000/api/products/<PRODUCT_ID>
```

#### Create Product (MERCHANT/ADMIN only)
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "description": "A test product description",
    "price": 99.99,
    "category": "Electronics",
    "stock": 50,
    "imageUrl": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
    "brand": "TestBrand",
    "rating": 4.5,
    "reviewCount": 100
  }'
```

**Expected:** ✅ Works for MERCHANT
**Expected:** ❌ 403 Forbidden for USER role

#### View Merchant's Products
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/merchant/products
```

#### View Merchant Sales Stats
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/merchant/sales
```

---

### 3. Shopping & Orders

#### Purchase Products (Authenticated)
```bash
curl -X POST http://localhost:3000/api/purchase \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "<PRODUCT_ID>",
        "quantity": 2
      }
    ],
    "shippingAddress": "123 Main St, City, State 12345",
    "paymentMethod": "Credit Card"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Purchase completed successfully",
  "data": {
    "order": {
      "_id": "...",
      "customerId": "...",
      "items": [...],
      "totalAmount": 199.98,
      "status": "pending"
    },
    "stockUpdated": true
  }
}
```

#### View My Orders
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/orders/customer/<USER_ID>
```

#### View Merchant Earnings
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/orders/merchant/<MERCHANT_ID>
```

**Expected Response:**
```json
{
  "success": true,
  "count": 5,
  "data": {
    "orders": [...],
    "stats": {
      "totalOrders": 5,
      "totalRevenue": 1249.95,
      "itemsSold": 15
    }
  }
}
```

---

### 4. Admin Endpoints (ADMIN role only)

#### Create Admin User (First admin - direct DB insert)
```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/user-service

# Create admin user
db.users.insertOne({
  email: "admin@test.com",
  password: "$2a$10$...", // Use bcrypt to hash "password123"
  firstName: "Admin",
  lastName: "User",
  role: "ADMIN",
  createdAt: new Date(),
  updatedAt: new Date()
})
```

Or register normally then update via MongoDB:
```bash
mongosh mongodb://localhost:27017/user-service

db.users.updateOne(
  { email: "user@test.com" },
  { $set: { role: "ADMIN" } }
)
```

#### Get All Users (Admin)
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3002/api/admin/users
```

#### Change User Role (Admin)
```bash
curl -X PUT http://localhost:3002/api/admin/users/<USER_ID>/role \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "MERCHANT"}'
```

#### Get User Statistics
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3002/api/admin/stats
```

---

## 🧪 Testing Scenarios

### Scenario 1: Regular User Flow
1. ✅ Register as USER
2. ✅ Login and get token
3. ✅ View products
4. ✅ Purchase products
5. ✅ View own orders
6. ❌ Try to create product (should fail with 403)

### Scenario 2: Merchant Flow
1. ✅ Register as MERCHANT
2. ✅ Login and get token
3. ✅ Create products
4. ✅ View own products
5. ✅ User purchases merchant's product
6. ✅ Merchant views earnings

### Scenario 3: Role Upgrade Flow
1. ✅ User registers as USER
2. ❌ Try to create product (403 Forbidden)
3. ✅ Admin changes role to MERCHANT
4. ✅ User logs in again (new token with MERCHANT role)
5. ✅ Now can create products

### Scenario 4: Stock Management
1. ✅ Check product stock
2. ✅ Purchase with quantity
3. ✅ Verify stock decreased
4. ❌ Try to purchase more than available (should fail)

---

## 🔍 Verification Checklist

### Database
- [ ] MongoDB is running
- [ ] All 3 databases created (user-service, product-service, order-service)
- [ ] Products seeded successfully (10 products)

### Services
- [ ] User service running on port 3002
- [ ] Product service running on port 3000
- [ ] Order service running on port 3001
- [ ] Frontend running on port 5173

### Features
- [ ] User registration works (USER and MERCHANT)
- [ ] Login returns JWT token with role
- [ ] Products API returns seeded data
- [ ] MERCHANT can create products
- [ ] USER cannot create products (403)
- [ ] Purchase flow works (creates order + updates stock)
- [ ] Merchant can view earnings
- [ ] Admin can change user roles

---

## 🐛 Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB is running
docker ps | grep mongodb

# Check MongoDB logs
docker logs mongodb

# Test connection
mongosh mongodb://localhost:27017
```

### Port Already in Use
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
lsof -ti:3002 | xargs kill -9
```

### JWT Token Issues
- Make sure JWT_SECRET is same across services
- Check token expiration (default 24h)
- Verify Authorization header format: `Bearer <token>`

### CORS Issues
- Frontend must run on same host or CORS enabled
- Check CORS middleware in each service

---

## 📊 Sample Test Data

### Test Users
| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| user@test.com | password123 | USER | Regular shopping |
| merchant@test.com | password123 | MERCHANT | Sell products |
| admin@test.com | password123 | ADMIN | Manage users |

### Seeded Products (After running seed script)
- MacBook Pro ($2499.99)
- Sony Headphones ($399.99)
- Denim Jacket ($89.99)
- Programming Books ($249.99)
- Instant Pot ($99.99)
- Yoga Mat ($49.99)
- LEGO Taj Mahal ($369.99)
- Skincare Set ($129.99)
- Dash Cam ($159.99)
- Security System ($299.99)

---

## 🎯 Next Steps After Testing

Once verified:
1. Test frontend UI (http://localhost:5173)
2. Test role-based access in UI
3. Test cart functionality
4. Deploy to Kubernetes for full integration
5. Monitor with Datadog APM

---

## 📝 API Endpoints Summary

| Service | Endpoint | Method | Auth | Role | Description |
|---------|----------|--------|------|------|-------------|
| User | /api/auth/register | POST | No | - | Register user |
| User | /api/auth/login | POST | No | - | Login |
| User | /api/auth/me | GET | Yes | - | Get profile |
| User | /api/admin/users | GET | Yes | ADMIN | List users |
| User | /api/admin/users/:id/role | PUT | Yes | ADMIN | Change role |
| Product | /api/products | GET | No | - | List products |
| Product | /api/products | POST | Yes | MERCHANT/ADMIN | Create product |
| Product | /api/merchant/products | GET | Yes | MERCHANT/ADMIN | My products |
| Product | /api/merchant/sales | GET | Yes | MERCHANT/ADMIN | Sales stats |
| Product | /api/purchase | POST | Yes | - | Buy products |
| Order | /api/orders/customer/:id | GET | Yes | - | My orders |
| Order | /api/orders/merchant/:id | GET | Yes | MERCHANT/ADMIN | Merchant earnings |

Good luck with testing! 🚀
