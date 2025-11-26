/**
 * Department Assignment Tests
 * Tests: Department assignment, transfer, history
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';

test.describe('Department Assignment API', () => {
  let adminToken: string;
  let testUserId: number;
  let departmentId: number;

  test.beforeAll(async ({ request }) => {
    const adminLogin = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'admin@example.com', password: 'admin123' }
    });
    adminToken = (await adminLogin.json()).access_token;

    // Get or create a department
    const deptResponse = await request.get(`${BASE_URL}/api/departments`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const departments = await deptResponse.json();
    if (departments.length > 0) {
      departmentId = departments[0].id;
    }

    // Create test user
    const createUser = await request.post(`${BASE_URL}/api/employees`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        email: `dept.test.${Date.now()}@example.com`,
        password: 'Test@123456',
        first_name: 'Department',
        last_name: 'Test',
        role: 'employee'
      }
    });
    testUserId = (await createUser.json()).id;
  });

  test('01. Assign employee to department should succeed', async ({ request }) => {
    if (!departmentId) {
      test.skip();
      return;
    }

    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        department_id: departmentId
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.department_id).toBe(departmentId);
  });

  test('02. Get employee should include department info', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (departmentId) {
      expect(data.department_id).toBe(departmentId);
      expect(data.department).toBeDefined();
      expect(data.department.id).toBe(departmentId);
      expect(data.department.name).toBeDefined();
    }
  });

  test('03. Department transfer should create history entry', async ({ request }) => {
    if (!departmentId) {
      test.skip();
      return;
    }

    // Get department history before transfer
    const beforeResponse = await request.get(`${BASE_URL}/api/employees/${testUserId}/department-history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const beforeData = await beforeResponse.json();
    const beforeCount = beforeData.length;

    // Transfer to another department (or null)
    await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        department_id: null
      }
    });

    // Get history after transfer
    const afterResponse = await request.get(`${BASE_URL}/api/employees/${testUserId}/department-history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const afterData = await afterResponse.json();
    expect(afterData.length).toBeGreaterThan(beforeCount);
  });

  test('04. Department history should include metadata', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees/${testUserId}/department-history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.length > 0) {
      const entry = data[0];
      expect(entry.id).toBeDefined();
      expect(entry.user_id).toBe(testUserId);
      expect(entry.changed_by_id).toBeDefined();
      expect(entry.changed_at).toBeDefined();
    }
  });

  test('05. Assign to non-existent department should fail', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        department_id: 999999
      }
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('06. Multiple department transfers should be tracked', async ({ request }) => {
    if (!departmentId) {
      test.skip();
      return;
    }

    // Transfer back and forth
    await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { department_id: departmentId }
    });

    await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { department_id: null }
    });

    await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { department_id: departmentId }
    });

    // Check history
    const response = await request.get(`${BASE_URL}/api/employees/${testUserId}/department-history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const data = await response.json();
    expect(data.length).toBeGreaterThanOrEqual(3);
  });

  test('07. Department history should be ordered by date descending', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees/${testUserId}/department-history`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const data = await response.json();

    // Check order
    for (let i = 1; i < data.length; i++) {
      const current = new Date(data[i].changed_at);
      const previous = new Date(data[i - 1].changed_at);
      expect(current <= previous).toBeTruthy();
    }
  });

  test('08. Filter employees by department should work', async ({ request }) => {
    if (!departmentId) {
      test.skip();
      return;
    }

    const response = await request.get(`${BASE_URL}/api/employees?department_id=${departmentId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.every((emp: any) => emp.department_id === departmentId)).toBeTruthy();
  });
});
