/**
 * Search, Filter, and Pagination Tests
 * Tests: Server-side search, filtering, sorting, pagination
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';

test.describe('Search, Filter, and Pagination API', () => {
  let adminToken: string;
  let testEmployeeIds: number[] = [];

  test.beforeAll(async ({ request }) => {
    const adminLogin = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'admin@example.com', password: 'admin123' }
    });
    adminToken = (await adminLogin.json()).access_token;

    // Create test employees for search/filter testing
    const employees = [
      { first_name: 'Alice', last_name: 'Anderson', role: 'employee', department_id: null },
      { first_name: 'Bob', last_name: 'Brown', role: 'manager', department_id: null },
      { first_name: 'Charlie', last_name: 'Chen', role: 'employee', department_id: null },
      { first_name: 'Diana', last_name: 'Davis', role: 'scheduler', department_id: null },
      { first_name: 'Eve', last_name: 'Evans', role: 'employee', department_id: null }
    ];

    for (const emp of employees) {
      const response = await request.post(`${BASE_URL}/api/employees`, {
        headers: { 'Authorization': `Bearer ${adminToken}` },
        data: {
          email: `${emp.first_name.toLowerCase()}.${Date.now()}@example.com`,
          password: 'Test@123456',
          ...emp
        }
      });
      const data = await response.json();
      testEmployeeIds.push(data.id);
    }
  });

  test('01. Search by first name should return matching results', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees?search=Alice`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.some((emp: any) => emp.first_name === 'Alice')).toBeTruthy();
  });

  test('02. Search by last name should return matching results', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees?search=Brown`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.some((emp: any) => emp.last_name === 'Brown')).toBeTruthy();
  });

  test('03. Search by email should return matching results', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees?search=alice`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.some((emp: any) => emp.email.toLowerCase().includes('alice'))).toBeTruthy();
  });

  test('04. Search should be case-insensitive', async ({ request }) => {
    const responses = await Promise.all([
      request.get(`${BASE_URL}/api/employees?search=ALICE`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }),
      request.get(`${BASE_URL}/api/employees?search=alice`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }),
      request.get(`${BASE_URL}/api/employees?search=Alice`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      })
    ]);

    const results = await Promise.all(responses.map(r => r.json()));
    expect(results[0].length).toBe(results[1].length);
    expect(results[1].length).toBe(results[2].length);
  });

  test('05. Filter by role should return only matching roles', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees?role=manager`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.every((emp: any) => emp.role === 'manager')).toBeTruthy();
  });

  test('06. Filter by is_active should work', async ({ request }) => {
    // Deactivate one employee
    await request.patch(`${BASE_URL}/api/employees/${testEmployeeIds[0]}/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { action: 'inactive', reason: 'Test' }
    });

    // Filter for active only
    const activeResponse = await request.get(`${BASE_URL}/api/employees?is_active=true`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const activeData = await activeResponse.json();
    expect(activeData.every((emp: any) => emp.is_active === true)).toBeTruthy();

    // Filter for inactive only
    const inactiveResponse = await request.get(`${BASE_URL}/api/employees?is_active=false`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const inactiveData = await inactiveResponse.json();
    expect(inactiveData.every((emp: any) => emp.is_active === false)).toBeTruthy();
  });

  test('07. Combine search and filter should work', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees?search=e&role=employee`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.every((emp: any) => emp.role === 'employee')).toBeTruthy();
  });

  test('08. Sort by first_name ascending should work', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees?sort_by=first_name&sort_order=asc`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    // Check if sorted alphabetically
    for (let i = 1; i < data.length; i++) {
      expect(data[i].first_name >= data[i - 1].first_name).toBeTruthy();
    }
  });

  test('09. Sort by last_name descending should work', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees?sort_by=last_name&sort_order=desc`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    // Check if sorted reverse alphabetically
    for (let i = 1; i < data.length; i++) {
      expect(data[i].last_name <= data[i - 1].last_name).toBeTruthy();
    }
  });

  test('10. Pagination with limit should work', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees?limit=3`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.length).toBeLessThanOrEqual(3);
  });

  test('11. Pagination with offset should work', async ({ request }) => {
    // Get first page
    const page1 = await request.get(`${BASE_URL}/api/employees?limit=2&offset=0`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const page1Data = await page1.json();

    // Get second page
    const page2 = await request.get(`${BASE_URL}/api/employees?limit=2&offset=2`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const page2Data = await page2.json();

    // Pages should have different employees
    expect(page1Data[0].id).not.toBe(page2Data[0].id);
  });

  test('12. Combine all parameters should work', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/employees?search=e&role=employee&is_active=true&sort_by=first_name&sort_order=asc&limit=5&offset=0`,
      {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();

    // Check filters applied
    expect(data.every((emp: any) => emp.role === 'employee')).toBeTruthy();
    expect(data.every((emp: any) => emp.is_active === true)).toBeTruthy();

    // Check sorting
    for (let i = 1; i < data.length; i++) {
      expect(data[i].first_name >= data[i - 1].first_name).toBeTruthy();
    }

    // Check limit
    expect(data.length).toBeLessThanOrEqual(5);
  });

  test('13. Invalid sort field should be handled gracefully', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees?sort_by=invalid_field`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    // Should either reject or fallback to default
    expect([200, 422].includes(response.status())).toBeTruthy();
  });

  test('14. Negative offset should be handled', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees?offset=-5`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    // Should either reject or treat as 0
    expect([200, 422].includes(response.status())).toBeTruthy();
  });

  test('15. Very large limit should be capped', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees?limit=10000`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    // Should be capped to reasonable limit (e.g., 100)
    expect(data.length).toBeLessThanOrEqual(100);
  });
});
