/**
 * Role Management & RBAC Tests
 * Tests: Role assignment, permissions, authorization
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';

test.describe('Role Management & RBAC API', () => {
  let adminToken: string;
  let managerToken: string;
  let employeeToken: string;
  let testUserId: number;

  test.beforeAll(async ({ request }) => {
    // Login as admin
    const adminLogin = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'admin@example.com', password: 'admin123' }
    });
    adminToken = (await adminLogin.json()).access_token;

    // Create a test user for role testing
    const createUser = await request.post(`${BASE_URL}/api/employees`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        email: `role.test.${Date.now()}@example.com`,
        password: 'Test@123456',
        first_name: 'Role',
        last_name: 'Test',
        role: 'employee'
      }
    });
    testUserId = (await createUser.json()).id;
  });

  test('01. Get current user role should return correct role', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const data = await response.json();
    expect(data.role).toBe('admin');
  });

  test('02. Admin should be able to change user role', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/role`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        role: 'manager',
        reason: 'Promotion to manager role'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.role).toBe('manager');
  });

  test('03. Role change should be logged in history', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees/${testUserId}/role-history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);

    const latestChange = data[0];
    expect(latestChange.old_role).toBe('employee');
    expect(latestChange.new_role).toBe('manager');
    expect(latestChange.reason).toContain('Promotion');
  });

  test('04. Valid roles should be: admin, manager, employee, scheduler', async ({ request }) => {
    const roles = ['admin', 'manager', 'employee', 'scheduler'];

    for (const role of roles) {
      const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/role`, {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: { role, reason: `Testing ${role} role` }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.role).toBe(role);
    }
  });

  test('05. Invalid role should be rejected', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/role`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        role: 'superuser', // Invalid role
        reason: 'Testing invalid role'
      }
    });

    expect(response.status()).toBe(422);
  });

  test('06. Role change without reason should fail', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/role`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        role: 'employee'
        // Missing reason
      }
    });

    expect(response.status()).toBe(422);
  });

  test('07. Non-admin should not be able to change roles', async ({ request }) => {
    // Create an employee user
    const createEmployee = await request.post(`${BASE_URL}/api/employees`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        email: `employee.noauth.${Date.now()}@example.com`,
        password: 'Test@123456',
        first_name: 'No',
        last_name: 'Auth',
        role: 'employee'
      }
    });

    const employeeData = await createEmployee.json();

    // Login as employee
    const employeeLogin = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: employeeData.email,
        password: 'Test@123456'
      }
    });

    const empToken = (await employeeLogin.json()).access_token;

    // Try to change role as employee
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/role`, {
      headers: { 'Authorization': `Bearer ${empToken}` },
      data: {
        role: 'admin',
        reason: 'Unauthorized attempt'
      }
    });

    expect(response.status()).toBe(403);
  });

  test('08. Admin cannot change own role (prevent self-demotion)', async ({ request }) => {
    // Get admin user ID
    const meResponse = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const adminUser = await meResponse.json();

    // Try to change own role
    const response = await request.patch(`${BASE_URL}/api/employees/${adminUser.id}/role`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        role: 'employee',
        reason: 'Self-demotion test'
      }
    });

    expect(response.status()).toBe(403);
  });

  test('09. Role history should include all changes', async ({ request }) => {
    // Make multiple role changes
    await request.patch(`${BASE_URL}/api/employees/${testUserId}/role`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { role: 'employee', reason: 'Demotion' }
    });

    await request.patch(`${BASE_URL}/api/employees/${testUserId}/role`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { role: 'manager', reason: 'Promotion again' }
    });

    // Get history
    const response = await request.get(`${BASE_URL}/api/employees/${testUserId}/role-history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const data = await response.json();
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  test('10. Role history should include metadata', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees/${testUserId}/role-history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const data = await response.json();
    const change = data[0];

    expect(change.id).toBeDefined();
    expect(change.user_id).toBe(testUserId);
    expect(change.old_role).toBeDefined();
    expect(change.new_role).toBeDefined();
    expect(change.changed_by_id).toBeDefined();
    expect(change.changed_at).toBeDefined();
    expect(change.reason).toBeDefined();
  });
});
