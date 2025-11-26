/**
 * Employee CRUD API Tests
 * Tests: Create, Read, Update, Delete employees
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';

test.describe('Employee CRUD API', () => {
  let adminToken: string;
  let testEmployeeId: number;
  let managerToken: string;
  let employeeToken: string;

  test.beforeAll(async ({ request }) => {
    // Login as admin
    const adminLogin = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'admin@example.com', password: 'admin123' }
    });
    const adminData = await adminLogin.json();
    adminToken = adminData.access_token;
  });

  test('01. Create employee as admin should succeed', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/employees`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        email: `test.employee.${Date.now()}@example.com`,
        password: 'Test@123456',
        first_name: 'John',
        last_name: 'Doe',
        role: 'employee',
        phone: '555-1234',
        hire_date: '2024-01-15'
      }
    });

    expect(response.status()).toBe(201);

    const data = await response.json();
    testEmployeeId = data.id;
    expect(data.first_name).toBe('John');
    expect(data.last_name).toBe('Doe');
    expect(data.email).toContain('test.employee');
    expect(data.role).toBe('employee');
    expect(data.phone).toBe('555-1234');
  });

  test('02. Get all employees as admin should succeed', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);

    // Check structure
    const employee = data[0];
    expect(employee.id).toBeDefined();
    expect(employee.email).toBeDefined();
    expect(employee.first_name).toBeDefined();
    expect(employee.last_name).toBeDefined();
  });

  test('03. Get employee by ID as admin should succeed', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees/${testEmployeeId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.id).toBe(testEmployeeId);
    expect(data.first_name).toBe('John');
    expect(data.last_name).toBe('Doe');
  });

  test('04. Get non-existent employee should return 404', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees/999999`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(response.status()).toBe(404);
  });

  test('05. Update employee as admin should succeed', async ({ request }) => {
    const response = await request.put(`${BASE_URL}/api/employees/${testEmployeeId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        first_name: 'Jane',
        last_name: 'Smith',
        phone: '555-5678'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.first_name).toBe('Jane');
    expect(data.last_name).toBe('Smith');
    expect(data.phone).toBe('555-5678');
  });

  test('06. Partial update (PATCH) employee should succeed', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testEmployeeId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        phone: '555-9999'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.phone).toBe('555-9999');
    expect(data.first_name).toBe('Jane'); // Should remain unchanged
  });

  test('07. Create employee without authentication should fail', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/employees`, {
      data: {
        email: `unauthorized.${Date.now()}@example.com`,
        password: 'Test@123456',
        first_name: 'Unauthorized',
        last_name: 'User',
        role: 'employee'
      }
    });

    expect(response.status()).toBe(401);
  });

  test('08. Create employee with invalid email should fail', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/employees`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        email: 'invalid-email',
        password: 'Test@123456',
        first_name: 'Invalid',
        last_name: 'Email',
        role: 'employee'
      }
    });

    expect(response.status()).toBe(422); // Validation error
  });

  test('09. Update employee with invalid data should fail', async ({ request }) => {
    const response = await request.put(`${BASE_URL}/api/employees/${testEmployeeId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        email: 'invalid-email'
      }
    });

    expect(response.status()).toBe(422);
  });

  test('10. Delete employee as admin should succeed', async ({ request }) => {
    // Create a new employee to delete
    const createResponse = await request.post(`${BASE_URL}/api/employees`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        email: `delete.test.${Date.now()}@example.com`,
        password: 'Test@123456',
        first_name: 'Delete',
        last_name: 'Test',
        role: 'employee'
      }
    });

    const created = await createResponse.json();
    const deleteId = created.id;

    // Delete the employee
    const deleteResponse = await request.delete(`${BASE_URL}/api/employees/${deleteId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(deleteResponse.status()).toBe(204);

    // Verify deleted
    const getResponse = await request.get(`${BASE_URL}/api/employees/${deleteId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(getResponse.status()).toBe(404);
  });

  test('11. Employee fields should include all expected attributes', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/employees/${testEmployeeId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const data = await response.json();

    // Core fields
    expect(data.id).toBeDefined();
    expect(data.email).toBeDefined();
    expect(data.first_name).toBeDefined();
    expect(data.last_name).toBeDefined();
    expect(data.role).toBeDefined();

    // Optional fields
    expect(data.phone).toBeDefined();
    expect(data.hire_date).toBeDefined();

    // Status fields
    expect(data.is_active).toBeDefined();
    expect(data.email_verified).toBeDefined();

    // Timestamps
    expect(data.created_at).toBeDefined();
    expect(data.updated_at).toBeDefined();
  });

  test('12. Create employee with all optional fields should succeed', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/employees`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        email: `full.profile.${Date.now()}@example.com`,
        password: 'Test@123456',
        first_name: 'Full',
        last_name: 'Profile',
        role: 'employee',
        phone: '555-0000',
        hire_date: '2024-01-01',
        hourly_rate: 25.50,
        max_hours_per_week: 40,
        qualifications: ['JavaScript', 'TypeScript', 'React'],
        availability: {
          monday: { available: true, start: '09:00', end: '17:00' },
          tuesday: { available: true, start: '09:00', end: '17:00' }
        }
      }
    });

    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.hourly_rate).toBe('25.50');
    expect(data.max_hours_per_week).toBe(40);
    expect(data.qualifications).toEqual(['JavaScript', 'TypeScript', 'React']);
    expect(data.availability.monday.available).toBe(true);
  });
});
