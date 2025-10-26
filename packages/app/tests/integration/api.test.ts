import request from 'supertest';
import app from '../../src/app';

describe('API Integration Tests', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('GET /api/products', () => {
    it('should return all products', async () => {
      const response = await request(app).get('/api/products');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should include X-Scenario header', async () => {
      const response = await request(app).get('/api/products');

      expect(response.headers).toHaveProperty('x-scenario', 'normal');
    });

    it('should handle error scenario', async () => {
      const response = await request(app).get('/api/products?scenario=error');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body).toHaveProperty('message', 'Simulated client error');
      expect(response.headers).toHaveProperty('x-scenario', 'error');
    });

    it('should handle internal-error scenario', async () => {
      const response = await request(app).get('/api/products?scenario=internal-error');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return a product by valid ID', async () => {
      const response = await request(app).get('/api/products/1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id', '1');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('price');
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app).get('/api/products/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Product not found');
      expect(response.body).toHaveProperty('id', '999');
    });
  });

  describe('POST /api/products', () => {
    it('should create a new product', async () => {
      const newProduct = {
        name: 'Test Product',
        price: 99.99,
        category: 'Electronics',
        stock: 100,
      };

      const response = await request(app)
        .post('/api/products')
        .send(newProduct);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Product created successfully');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name', newProduct.name);
      expect(response.body.data).toHaveProperty('price', newProduct.price);
      expect(response.body.data).toHaveProperty('createdAt');
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteProduct = {
        name: 'Test Product',
        // Missing price, category, and stock
      };

      const response = await request(app)
        .post('/api/products')
        .send(incompleteProduct);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Missing required fields');
      expect(response.body).toHaveProperty('required');
    });
  });

  describe('PUT /api/products/:id', () => {
    it('should update an existing product', async () => {
      const updates = {
        name: 'Updated Laptop',
        price: 1099.99,
      };

      const response = await request(app)
        .put('/api/products/1')
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Product updated successfully');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('name', updates.name);
      expect(response.body.data).toHaveProperty('price', updates.price);
    });

    it('should return 404 for non-existent product', async () => {
      const updates = {
        name: 'Updated Product',
      };

      const response = await request(app)
        .put('/api/products/999')
        .send(updates);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Product not found');
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('should delete an existing product', async () => {
      const response = await request(app).delete('/api/products/2');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Product deleted successfully');
      expect(response.body).toHaveProperty('data');
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app).delete('/api/products/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Product not found');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Route not found');
      expect(response.body).toHaveProperty('path', '/non-existent-route');
    });
  });
});
