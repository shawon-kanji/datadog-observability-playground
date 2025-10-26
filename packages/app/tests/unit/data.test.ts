import { products, Product } from '../../src/data';

describe('Product Data', () => {
  it('should have exactly 5 products', () => {
    expect(products).toHaveLength(5);
  });

  it('should have products with all required fields', () => {
    products.forEach((product) => {
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('category');
      expect(product).toHaveProperty('stock');
      expect(product).toHaveProperty('createdAt');
    });
  });

  it('should have valid product IDs', () => {
    const ids = products.map(p => p.id);
    expect(ids).toEqual(['1', '2', '3', '4', '5']);
    // Check for unique IDs
    expect(new Set(ids).size).toBe(products.length);
  });

  it('should have positive prices', () => {
    products.forEach((product) => {
      expect(product.price).toBeGreaterThan(0);
    });
  });

  it('should have non-negative stock', () => {
    products.forEach((product) => {
      expect(product.stock).toBeGreaterThanOrEqual(0);
    });
  });

  it('should have valid dates', () => {
    products.forEach((product) => {
      expect(product.createdAt).toBeInstanceOf(Date);
      expect(product.createdAt.getTime()).not.toBeNaN();
    });
  });

  it('should have non-empty names', () => {
    products.forEach((product) => {
      expect(product.name).toBeTruthy();
      expect(product.name.length).toBeGreaterThan(0);
    });
  });

  it('should have valid categories', () => {
    const validCategories = ['Electronics', 'Furniture'];
    products.forEach((product) => {
      expect(validCategories).toContain(product.category);
    });
  });

  it('should have correct product details for product 1', () => {
    const laptop = products.find(p => p.id === '1');
    expect(laptop).toBeDefined();
    expect(laptop?.name).toBe('Laptop');
    expect(laptop?.price).toBe(999.99);
    expect(laptop?.category).toBe('Electronics');
    expect(laptop?.stock).toBe(50);
  });
});
