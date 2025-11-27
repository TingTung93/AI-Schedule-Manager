import { test } from '@playwright/test';
import { EmployeeTestHelpers } from '../helpers/employee-helpers';
import { validEmployees } from '../fixtures/employee-fixtures';

test('Debug: Check menu items', async ({ page, request }) => {
  const helpers = new EmployeeTestHelpers(page, request);
  
  // Login as admin
  await helpers.loginAsAdmin();
  await helpers.navigateToEmployees();
  
  // Create an employee to delete
  await helpers.openAddEmployeeDialog();
  await helpers.fillEmployeeForm({
    firstName: 'Debug',
    lastName: 'Test',
    email: 'debug.test@test.com'
  });
  await helpers.submitEmployeeForm(true);
  
  // Open the menu
  await helpers.openEmployeeActionsMenu('debug.test@test.com');
  
  // List all menu items
  const menuItems = await page.locator('[role="menuitem"]').all();
  console.log(`Found ${menuItems.length} menu items:`);
  for (const item of menuItems) {
    const text = await item.textContent();
    console.log(`  - "${text}"`);
  }
  
  // Take a screenshot
  await page.screenshot({ path: '/tmp/menu-debug.png', fullPage: true });
});
