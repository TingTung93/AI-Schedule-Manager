/**
 * Global Teardown for E2E Tests
 * Runs once after all tests complete
 */

module.exports = async (config) => {
  console.log('');
  console.log('🧹 Cleaning up after E2E tests...');

  // Add any global cleanup logic here
  // Example: Close test database, cleanup test files, etc.

  console.log('✅ Global teardown completed');
  console.log('📊 E2E Test Suite finished');
};
