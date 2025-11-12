const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();

  console.log('🔍 Testing dashboard after routing fix...\n');

  // Navigate to dashboard
  await page.goto('http://localhost:3002/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Check for dashboard content
  const welcomeText = await page.locator('text=/Welcome back/i').count();
  const statsCards = await page.locator('[class*="MuiCard"]').count();
  const quickActions = await page.locator('text=/Quick Actions/i').count();
  const weeklyProgress = await page.locator('text=/Weekly Progress/i').count();
  const recentActivities = await page.locator('text=/Recent Activities/i').count();

  console.log('📊 Dashboard Elements Found:');
  console.log(`  ✓ Welcome message: ${welcomeText > 0 ? 'YES' : 'NO'}`);
  console.log(`  ✓ Stats cards: ${statsCards}`);
  console.log(`  ✓ Quick Actions section: ${quickActions > 0 ? 'YES' : 'NO'}`);
  console.log(`  ✓ Weekly Progress: ${weeklyProgress > 0 ? 'YES' : 'NO'}`);
  console.log(`  ✓ Recent Activities: ${recentActivities > 0 ? 'YES' : 'NO'}`);

  // Take screenshot
  await page.screenshot({ path: 'dashboard-fixed.png', fullPage: true });
  console.log('\n📸 Screenshot saved: dashboard-fixed.png');

  if (welcomeText > 0 && statsCards > 0 && quickActions > 0) {
    console.log('\n✅ Dashboard is now rendering correctly!');
  } else {
    console.log('\n⚠️  Dashboard still has issues');
  }

  await browser.close();
})();
