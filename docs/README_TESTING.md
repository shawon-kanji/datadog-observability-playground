# 🧪 Complete Testing Guide

## 🎯 What's Been Implemented

### ✅ Backend Features
1. **User Management & Roles**
   - USER, MERCHANT, ADMIN roles
   - Merchant self-registration
   - Admin role management panel

2. **Product Management**
   - MongoDB-backed CRUD
   - Role-based authorization (MERCHANT/ADMIN only)
   - Enhanced schema: images, ratings, merchant tracking

3. **Purchase & Order System**
   - Complete purchase flow
   - Stock management
   - Merchant earnings tracking

4. **Authorization**
   - JWT-based authentication
   - Role-based middleware
   - Protected endpoints

### ✅ Frontend Foundation
- Dark theme (Amazon-style)
- Cart context with localStorage
- Role-based routing
- Protected routes

---

## 🚀 Quick Start Options

### Option A: Docker Compose (Easiest)

```bash
# 1. Start all services
docker-compose -f docker-compose.dev.yml up -d

# 2. Seed database
docker exec -it product-service-dev pnpm seed

# 3. Access frontend
open http://localhost:8080

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

See [DOCKER_GUIDE.md](./DOCKER_GUIDE.md) for detailed Docker instructions.

### Option B: Local Development

```bash
# 1. Start MongoDB
docker run -d --name mongodb -p 27017:27017 mongo:7

# 2. Install dependencies
pnpm install

# 3. Seed database
cd packages/app && pnpm seed && cd ../..

# 4. Start services in separate terminals
# Terminal 1
cd packages/user-service && pnpm dev

# Terminal 2
cd packages/app && pnpm dev

# Terminal 3
cd packages/order-service && pnpm dev

# Terminal 4
cd packages/frontend && pnpm dev

# 5. Access frontend
open http://localhost:5173
```

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for detailed API testing.

---

## 🧪 Test Scenarios

### Scenario 1: USER Registration & Shopping

```bash
# 1. Register as USER
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shopper@test.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Shopper"
  }'

# Save the token
TOKEN="paste-token-here"

# 2. Browse products
curl http://localhost:3000/api/products

# 3. Purchase products
curl -X POST http://localhost:3000/api/purchase \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "PRODUCT_ID", "quantity": 2}],
    "shippingAddress": "123 Main St",
    "paymentMethod": "Credit Card"
  }'

# 4. Try to create product (should fail - 403 Forbidden)
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "description": "Test", "price": 99, "category": "Electronics", "stock": 10, "imageUrl": "http://test.com/image.jpg"}'
```

**Expected Results:**
- ✅ Registration successful
- ✅ Can view products
- ✅ Can purchase products
- ❌ Cannot create products (403 Forbidden)

---

### Scenario 2: MERCHANT Registration & Sales

```bash
# 1. Register as MERCHANT
curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@test.com",
    "password": "password123",
    "firstName": "Jane",
    "lastName": "Merchant",
    "role": "MERCHANT"
  }'

# Save the token
MERCHANT_TOKEN="paste-token-here"

# 2. Create a product
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer $MERCHANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Merchant Product",
    "description": "A great product from merchant",
    "price": 199.99,
    "category": "Electronics",
    "stock": 50,
    "imageUrl": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
    "brand": "MerchantBrand",
    "rating": 4.5,
    "reviewCount": 10
  }'

# 3. View my products
curl -H "Authorization: Bearer $MERCHANT_TOKEN" \
  http://localhost:3000/api/merchant/products

# 4. User purchases merchant's product
# (Use USER token from Scenario 1)

# 5. View earnings
curl -H "Authorization: Bearer $MERCHANT_TOKEN" \
  http://localhost:3001/api/orders/merchant/MERCHANT_USER_ID
```

**Expected Results:**
- ✅ Can register as MERCHANT
- ✅ Can create products
- ✅ Can view own products
- ✅ Can view earnings when products are sold

---

### Scenario 3: Admin Role Management

```bash
# 1. Create admin user (via MongoDB)
docker exec -it mongodb-dev mongosh mongodb://localhost:27017/user-service

db.users.updateOne(
  {email: "admin@test.com"},
  {$set: {role: "ADMIN"}},
  {upsert: false}
)
# Or register normally then update role

# 2. Login as admin
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.com", "password": "password123"}'

ADMIN_TOKEN="paste-token-here"

# 3. View all users
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3002/api/admin/users

# 4. Get user statistics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3002/api/admin/stats

# 5. Change user role (USER -> MERCHANT)
curl -X PUT http://localhost:3002/api/admin/users/USER_ID/role \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "MERCHANT"}'

# 6. User must login again to get new token with updated role
```

**Expected Results:**
- ✅ Admin can view all users
- ✅ Admin can change user roles
- ✅ User must re-login to get new permissions

---

## 📊 Verification Checklist

### Backend
- [ ] MongoDB running and accessible
- [ ] All 3 services running (user, product, order)
- [ ] Database seeded with 10 products
- [ ] User registration works (USER & MERCHANT)
- [ ] JWT tokens returned with role
- [ ] Role-based authorization working
- [ ] Purchase flow creates orders
- [ ] Stock decreases after purchase
- [ ] Merchant can view earnings

### Frontend
- [ ] Dark theme applied
- [ ] Can view products
- [ ] Cart functionality works
- [ ] Role-based navigation visible

---

## 🔍 Database Inspection

```bash
# Connect to MongoDB
docker exec -it mongodb-dev mongosh

# User Service Database
use user-service
db.users.find().pretty()
db.users.countDocuments({role: "MERCHANT"})

# Product Service Database
use product-service
db.products.find().limit(5).pretty()
db.products.countDocuments()

# Order Service Database
use order-service
db.orders.find().pretty()
db.orders.countDocuments()
```

---

## 🐛 Common Issues & Solutions

### Issue: MongoDB Connection Failed
```bash
# Check MongoDB is running
docker ps | grep mongodb

# Restart MongoDB
docker restart mongodb-dev

# Check logs
docker logs mongodb-dev
```

### Issue: Port Already in Use
```bash
# Kill processes
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
lsof -ti:3002 | xargs kill -9
```

### Issue: JWT Token Invalid
- Make sure JWT_SECRET is the same across all services
- Check token hasn't expired (24h default)
- Verify Authorization header format: `Bearer <token>`

### Issue: 403 Forbidden When Creating Products
- Confirm user has MERCHANT or ADMIN role
- User must re-login after role change
- Check JWT token includes role field

### Issue: Products Not Showing
- Run seed script: `docker exec -it product-service-dev pnpm seed`
- Check database: `docker exec -it mongodb-dev mongosh`
- Verify service is running: `curl http://localhost:3000/health`

---

## 📈 Testing Merchant Earnings

Complete flow to test merchant earnings:

```bash
# 1. Register merchant
# 2. Create product (save product ID)
# 3. Register regular user
# 4. User purchases merchant's product
# 5. Check merchant earnings:

curl -H "Authorization: Bearer $MERCHANT_TOKEN" \
  http://localhost:3001/api/orders/merchant/MERCHANT_ID

# Response shows:
# - Total orders containing merchant's products
# - Total revenue from sales
# - Total items sold
```

---

## 🎯 Next Testing Phase

After verifying backend, test:
1. Frontend UI navigation
2. Shopping cart functionality
3. Checkout flow
4. Role-based UI elements
5. Merchant dashboard
6. Admin panel

---

## 📚 Documentation

- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Detailed API testing
- [DOCKER_GUIDE.md](./DOCKER_GUIDE.md) - Docker Compose usage
- [API Documentation](#) - Full API reference

---

## 🚀 Quick Health Check

```bash
# Check all services
curl http://localhost:3000/health  # Product
curl http://localhost:3001/health  # Order
curl http://localhost:3002/health  # User

# All should return:
{
  "status": "healthy",
  "database": "connected"
}
```

---

## ✅ Success Criteria

You should be able to:
1. ✅ Register users with different roles
2. ✅ Merchants can create products
3. ✅ Users can purchase products
4. ✅ Stock updates after purchase
5. ✅ Merchants can view earnings
6. ✅ Admins can manage user roles
7. ✅ All role-based permissions enforced

**Ready to test!** 🎉
