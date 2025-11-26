/**
 * Authentication API Tests
 * Tests: Login, Registration, JWT Token validation
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';

test.describe('Authentication API', () => {
  let adminToken: string;
  let testUserEmail: string;

  test.beforeAll(async ({ request }) => {
    // Login as admin to get token for cleanup
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'admin@example.com',
        password: 'admin123'
      }
    });
    const loginData = await loginResponse.json();
    adminToken = loginData.access_token;
  });

  test('01. Health endpoint should return healthy status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
  });

  test('02. Login with valid admin credentials should succeed', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'admin@example.com',
        password: 'admin123'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.access_token).toBeDefined();
    expect(data.token_type).toBe('bearer');
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe('admin@example.com');
    expect(data.user.role).toBe('admin');
  });

  test('03. Login with invalid credentials should fail', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'admin@example.com',
        password: 'wrongpassword'
      }
    });

    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.detail).toContain('Incorrect email or password');
  });

  test('04. Login with non-existent user should fail', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'nonexistent@example.com',
        password: 'password123'
      }
    });

    expect(response.status()).toBe(401);
  });

  test('05. Register new user should succeed', async ({ request }) => {
    testUserEmail = `test.user.${Date.now()}@example.com`;

    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: testUserEmail,
        password: 'Test@123456',
        first_name: 'Test',
        last_name: 'User',
        role: 'employee'
      }
    });

    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.email).toBe(testUserEmail);
    expect(data.first_name).toBe('Test');
    expect(data.last_name).toBe('User');
    expect(data.role).toBe('employee');
    expect(data.id).toBeDefined();
  });

  test('06. Register with duplicate email should fail', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'admin@example.com', // Already exists
        password: 'Test@123456',
        first_name: 'Duplicate',
        last_name: 'User',
        role: 'employee'
      }
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.detail).toContain('already registered');
  });

  test('07. Register with weak password should fail', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: `weak.password.${Date.now()}@example.com`,
        password: 'weak', // Too short, no special chars
        first_name: 'Weak',
        last_name: 'Password',
        role: 'employee'
      }
    });

    // Should fail validation
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('08. Get current user with valid token should succeed', async ({ request }) => {
    // First login
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'admin@example.com',
        password: 'admin123'
      }
    });

    const loginData = await loginResponse.json();
    const token = loginData.access_token;

    // Get current user
    const response = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.email).toBe('admin@example.com');
    expect(data.role).toBe('admin');
  });

  test('09. Get current user without token should fail', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/me`);

    expect(response.status()).toBe(401);
  });

  test('10. Get current user with invalid token should fail', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        'Authorization': 'Bearer invalid_token_12345'
      }
    });

    expect(response.status()).toBe(401);
  });

  test('11. Logout should invalidate token', async ({ request }) => {
    // Login first
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'admin@example.com',
        password: 'admin123'
      }
    });

    const loginData = await loginResponse.json();
    const token = loginData.access_token;

    // Logout
    const logoutResponse = await request.post(`${BASE_URL}/api/auth/logout`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(logoutResponse.status()).toBe(200);
  });

  test('12. Token should contain correct claims', async ({ request }) => {
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'admin@example.com',
        password: 'admin123'
      }
    });

    const loginData = await loginResponse.json();
    const token = loginData.access_token;

    // Decode JWT (base64)
    const parts = token.split('.');
    expect(parts.length).toBe(3);

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    expect(payload.sub).toBeDefined(); // Subject (user ID)
    expect(payload.exp).toBeDefined(); // Expiration
  });
});
