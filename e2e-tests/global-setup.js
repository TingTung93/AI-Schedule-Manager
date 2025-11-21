/**
 * Global Setup for E2E Tests
 * Runs once before all tests
 */

module.exports = async (config) => {
  console.log('🚀 Starting E2E Test Suite...');
  console.log('📋 Configuration:');
  console.log(`  - Base URL: ${config.use?.baseURL || 'http://localhost:3000'}`);
  console.log(`  - Workers: ${config.workers || 'auto'}`);
  console.log(`  - Timeout: ${config.timeout || 30000}ms`);
  console.log('');

  // Add any global setup logic here
  // Example: Start test database, clear cache, etc.

  return async () => {
    console.log('✅ Global setup completed');
  };
};
