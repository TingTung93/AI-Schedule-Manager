/**
 * Demo E2E Tests - Working examples with mock data
 */

import { test, expect } from '@playwright/test';
import { setupMockServer } from '../fixtures/mock-server';

test.describe('Demo E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup mock server for testing without backend
    await setupMockServer(page);
  });

  test('should demonstrate login flow with mocked API', async ({ page }) => {
    // Create a mock login page that doesn't rely on fetch
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>AI Schedule Manager - Login</title></head>
        <body>
          <h1>AI Schedule Manager</h1>
          <form id="login-form">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required>
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required>
            <button type="submit">Sign In</button>
          </form>
          <div id="message"></div>
          <script>
            document.getElementById('login-form').addEventListener('submit', (e) => {
              e.preventDefault();
              const email = document.getElementById('email').value;
              const password = document.getElementById('password').value;
              // Simulate successful login without actual API call
              if (email === 'admin@test.com' && password === 'Admin123!') {
                document.getElementById('message').textContent = 'Login successful!';
              } else {
                document.getElementById('message').textContent = 'Login failed';
              }
            });
          </script>
        </body>
      </html>
    `);

    // Test the login flow
    await expect(page).toHaveTitle(/AI Schedule Manager/);
    
    await page.fill('#email', 'admin@test.com');
    await page.fill('#password', 'Admin123!');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('#message')).toHaveText('Login successful!');
  });

  test('should demonstrate rule parsing with mocked API', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Rule Management</title></head>
        <body>
          <h1>AI Schedule Manager - Rule Creator</h1>
          <div>
            <input type="text" id="rule-input" placeholder="Enter scheduling rule...">
            <button id="parse-btn">Parse Rule</button>
            <div id="result"></div>
          </div>
          <script>
            document.getElementById('parse-btn').addEventListener('click', () => {
              const ruleText = document.getElementById('rule-input').value;
              if (!ruleText) return;
              
              // Simulate parsing without actual API call
              let ruleType = 'availability';
              let employee = 'Test Employee';
              
              if (ruleText.includes('prefer')) ruleType = 'preference';
              if (ruleText.includes('need')) ruleType = 'requirement';
              if (ruleText.includes('Sarah')) employee = 'Sarah';
              if (ruleText.includes('John')) employee = 'John';
              
              document.getElementById('result').innerHTML = 
                '<h3>Parsed Rule</h3>' +
                '<p>Type: ' + ruleType + '</p>' +
                '<p>Employee: ' + employee + '</p>';
            });
          </script>
        </body>
      </html>
    `);

    // Test rule parsing
    await page.fill('#rule-input', "Sarah can't work past 5pm");
    await page.click('#parse-btn');
    
    await expect(page.locator('#result')).toContainText('Type: availability');
    await expect(page.locator('#result')).toContainText('Employee: Sarah');
  });

  test('should demonstrate calendar view', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Calendar View</title>
          <style>
            .calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
            .day { border: 1px solid #ccc; padding: 10px; min-height: 100px; }
            .shift { background: #e3f2fd; padding: 5px; margin: 2px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h1>Schedule Calendar</h1>
          <div class="calendar" data-testid="calendar-view">
            <div class="day">
              <strong>Monday</strong>
              <div class="shift" data-testid="shift-event">Morning: 9am-1pm</div>
            </div>
            <div class="day">
              <strong>Tuesday</strong>
              <div class="shift" data-testid="shift-event">Afternoon: 1pm-5pm</div>
            </div>
            <div class="day">
              <strong>Wednesday</strong>
              <div class="shift" data-testid="shift-event">Evening: 5pm-9pm</div>
            </div>
            <div class="day"><strong>Thursday</strong></div>
            <div class="day"><strong>Friday</strong></div>
            <div class="day"><strong>Saturday</strong></div>
            <div class="day"><strong>Sunday</strong></div>
          </div>
        </body>
      </html>
    `);

    // Test calendar display
    await expect(page.locator('[data-testid="calendar-view"]')).toBeVisible();
    
    const shifts = page.locator('[data-testid="shift-event"]');
    await expect(shifts).toHaveCount(3);
    
    await expect(shifts.first()).toContainText('Morning');
  });

  test('should demonstrate notification system', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Notifications</title>
          <style>
            .notification { 
              border: 1px solid #ccc; 
              padding: 10px; 
              margin: 5px; 
              border-radius: 5px;
            }
            .unread { background: #fff3cd; }
            .badge { 
              background: red; 
              color: white; 
              padding: 2px 6px; 
              border-radius: 10px;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <h1>Notification Center</h1>
          <button data-testid="notification-bell">
            Notifications <span class="badge" data-testid="notification-count">3</span>
          </button>
          <div id="notification-list" style="display: none;">
            <div class="notification unread" data-read="false">
              <strong>New Shift Assignment</strong>
              <p>You have been assigned to Morning Shift on Monday</p>
            </div>
            <div class="notification unread" data-read="false">
              <strong>Schedule Update</strong>
              <p>Your Thursday shift has been changed</p>
            </div>
            <div class="notification" data-read="true">
              <strong>Team Announcement</strong>
              <p>Staff meeting tomorrow at 10am</p>
            </div>
            <button id="mark-all-read">Mark All as Read</button>
          </div>
          <script>
            document.querySelector('[data-testid="notification-bell"]').addEventListener('click', () => {
              const list = document.getElementById('notification-list');
              list.style.display = list.style.display === 'none' ? 'block' : 'none';
            });
            
            document.getElementById('mark-all-read').addEventListener('click', () => {
              document.querySelectorAll('[data-read="false"]').forEach(n => {
                n.setAttribute('data-read', 'true');
                n.classList.remove('unread');
              });
              document.querySelector('[data-testid="notification-count"]').style.display = 'none';
            });
          </script>
        </body>
      </html>
    `);

    // Test notifications
    const bell = page.locator('[data-testid="notification-bell"]');
    await expect(bell).toBeVisible();
    
    const badge = page.locator('[data-testid="notification-count"]');
    await expect(badge).toHaveText('3');
    
    await bell.click();
    
    const unreadNotifications = page.locator('[data-read="false"]');
    await expect(unreadNotifications).toHaveCount(2);
    
    await page.click('#mark-all-read');
    await expect(unreadNotifications).toHaveCount(0);
    await expect(badge).not.toBeVisible();
  });

  test('should demonstrate schedule optimization UI', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>AI Schedule Optimization</title>
          <style>
            .optimization-panel { 
              border: 1px solid #ccc; 
              padding: 20px; 
              margin: 10px;
              border-radius: 5px;
            }
            .progress-bar {
              width: 100%;
              height: 20px;
              background: #f0f0f0;
              border-radius: 10px;
              overflow: hidden;
            }
            .progress-fill {
              height: 100%;
              background: #4caf50;
              transition: width 0.3s;
            }
          </style>
        </head>
        <body>
          <h1>AI Schedule Optimizer</h1>
          <div class="optimization-panel">
            <h2>Optimization Settings</h2>
            <label>
              <input type="checkbox" id="minimize-cost" checked>
              Minimize Labor Costs
            </label><br>
            <label>
              <input type="checkbox" id="balance-workload">
              Balance Workload
            </label><br>
            <label>
              <input type="checkbox" id="maximize-coverage">
              Maximize Coverage
            </label><br>
            <button id="optimize-btn">Start Optimization</button>
            
            <div id="progress" style="display: none; margin-top: 20px;">
              <p>Optimizing schedule...</p>
              <div class="progress-bar">
                <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
              </div>
              <p id="status">Analyzing constraints...</p>
            </div>
            
            <div id="results" style="display: none; margin-top: 20px;">
              <h3>Optimization Complete!</h3>
              <p>Labor Cost Saved: $450</p>
              <p>Coverage: 98%</p>
              <p>Employee Satisfaction: 92%</p>
            </div>
          </div>
          <script>
            document.getElementById('optimize-btn').addEventListener('click', () => {
              const progress = document.getElementById('progress');
              const results = document.getElementById('results');
              const fill = document.getElementById('progress-fill');
              const status = document.getElementById('status');
              
              progress.style.display = 'block';
              results.style.display = 'none';
              
              let percent = 0;
              const interval = setInterval(() => {
                percent += 20;
                fill.style.width = percent + '%';
                
                if (percent === 40) status.textContent = 'Generating solutions...';
                if (percent === 60) status.textContent = 'Evaluating options...';
                if (percent === 80) status.textContent = 'Finalizing schedule...';
                
                if (percent >= 100) {
                  clearInterval(interval);
                  setTimeout(() => {
                    progress.style.display = 'none';
                    results.style.display = 'block';
                  }, 500);
                }
              }, 500);
            });
          </script>
        </body>
      </html>
    `);

    // Test optimization UI
    await expect(page.locator('h1')).toHaveText('AI Schedule Optimizer');
    
    await page.check('#balance-workload');
    await page.check('#maximize-coverage');
    
    await page.click('#optimize-btn');
    
    await expect(page.locator('#progress')).toBeVisible();
    await expect(page.locator('#status')).toContainText('Analyzing constraints');
    
    // Wait for optimization to complete
    await page.waitForSelector('#results', { state: 'visible', timeout: 5000 });
    
    await expect(page.locator('#results')).toContainText('Labor Cost Saved: $450');
    await expect(page.locator('#results')).toContainText('Coverage: 98%');
  });
});