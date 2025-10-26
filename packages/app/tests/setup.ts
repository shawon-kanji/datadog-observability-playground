// Test setup file
process.env.NODE_ENV = 'test';
process.env.DD_TRACE_ENABLED = 'false'; // Disable Datadog tracing in tests
process.env.PORT = '3001'; // Use different port for tests
process.env.DD_SERVICE = 'test-datadog-crud-api-test';
process.env.DD_ENV = 'test';

// Mock uuid to avoid ES module issues in Jest
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-12345',
}));
