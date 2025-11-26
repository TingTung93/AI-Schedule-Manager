/**
 * Account Status Management Tests
 * Tests: Active, Inactive, Locked, Verified status management
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';

test.describe('Account Status Management API', () => {
  let adminToken: string;
  let testUserId: number;

  test.beforeAll(async ({ request }) => {
    const adminLogin = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'admin@example.com', password: 'admin123' }
    });
    adminToken = (await adminLogin.json()).access_token;

    // Create test user
    const createUser = await request.post(`${BASE_URL}/api/employees`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        email: `status.test.${Date.now()}@example.com`,
        password: 'Test@123456',
        first_name: 'Status',
        last_name: 'Test',
        role: 'employee'
      }
    });
    testUserId = (await createUser.json()).id;
  });

  test('01. Admin should be able to deactivate account', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        action: 'inactive',
        reason: 'User requested account deactivation'
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.is_active).toBe(false);
  });

  test('02. Admin should be able to activate account', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        action: 'active',
        reason: 'Account reactivation'
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.is_active).toBe(true);
  });

  test('03. Admin should be able to lock account', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        action: 'locked',
        reason: 'Security violation detected'
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.account_locked).toBe(true);
  });

  test('04. Admin should be able to unlock account', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        action: 'unlocked',
        reason: 'Issue resolved'
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.account_locked).toBe(false);
    expect(data.failed_login_attempts).toBe(0);
  });

  test('05. Admin should be able to verify email', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        action: 'verified'
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.email_verified).toBe(true);
  });

  test('06. Status change without reason should fail for destructive actions', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        action: 'inactive'
        // Missing reason
      }
    });

    expect(response.status()).toBe(422);
  });

  test('07. Get status history should return all changes', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees/${testUserId}/status-history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);
  });

  test('08. Status history should include metadata', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees/${testUserId}/status-history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const data = await response.json();
    const change = data[0];

    expect(change.id).toBeDefined();
    expect(change.user_id).toBe(testUserId);
    expect(change.old_status).toBeDefined();
    expect(change.new_status).toBeDefined();
    expect(change.changed_by_id).toBeDefined();
    expect(change.changed_at).toBeDefined();
  });

  test('09. Admin cannot change own account status (prevent self-lockout)', async ({ request }) => {
    const meResponse = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminUser = await meResponse.json();

    const response = await request.patch(`${BASE_URL}/api/employees/${adminUser.id}/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        action: 'inactive',
        reason: 'Self-deactivation test'
      }
    });

    expect(response.status()).toBe(403);
  });

  test('10. Non-admin should not be able to change status', async ({ request }) => {
    const createEmployee = await request.post(`${BASE_URL}/api/employees`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        email: `employee.status.${Date.now()}@example.com`,
        password: 'Test@123456',
        first_name: 'Employee',
        last_name: 'Status',
        role: 'employee'
      }
    });

    const employeeData = await createEmployee.json();
    const employeeLogin = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: employeeData.email, password: 'Test@123456' }
    });

    const empToken = (await employeeLogin.json()).access_token;

    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/status`, {
      headers: { 'Authorization': `Bearer ${empToken}` },
      data: {
        action: 'inactive',
        reason: 'Unauthorized'
      }
    });

    expect(response.status()).toBe(403);
  });
});
