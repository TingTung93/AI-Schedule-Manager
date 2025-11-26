/**
 * Password Management Tests
 * Tests: Password reset, password change, password history
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';

test.describe('Password Management API', () => {
  let adminToken: string;
  let testUserId: number;
  let testUserEmail: string;

  test.beforeAll(async ({ request }) => {
    const adminLogin = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'admin@example.com', password: 'admin123' }
    });
    adminToken = (await adminLogin.json()).access_token;

    // Create test user
    testUserEmail = `password.test.${Date.now()}@example.com`;
    const createUser = await request.post(`${BASE_URL}/api/employees`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        email: testUserEmail,
        password: 'OldPassword@123',
        first_name: 'Password',
        last_name: 'Test',
        role: 'employee'
      }
    });
    testUserId = (await createUser.json()).id;
  });

  test('01. Admin should be able to reset user password', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/employees/${testUserId}/reset-password`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        send_email: false
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.temporary_password).toBeDefined();
    expect(data.temporary_password.length).toBeGreaterThanOrEqual(12);
    expect(data.password_must_change).toBe(true);
  });

  test('02. Reset password should contain required character types', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/employees/${testUserId}/reset-password`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { send_email: false }
    });

    const data = await response.json();
    const password = data.temporary_password;

    // Check for uppercase
    expect(/[A-Z]/.test(password)).toBeTruthy();
    // Check for lowercase
    expect(/[a-z]/.test(password)).toBeTruthy();
    // Check for digit
    expect(/[0-9]/.test(password)).toBeTruthy();
    // Check for special char
    expect(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)).toBeTruthy();
  });

  test('03. User should be able to change own password', async ({ request }) => {
    // Login as test user with old password
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testUserEmail, password: 'OldPassword@123' }
    });

    const userToken = (await loginResponse.json()).access_token;

    // Change password
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/change-password`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
      data: {
        old_password: 'OldPassword@123',
        new_password: 'NewPassword@456'
      }
    });

    expect(response.status()).toBe(200);

    // Verify old password no longer works
    const oldLoginAttempt = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testUserEmail, password: 'OldPassword@123' }
    });
    expect(oldLoginAttempt.status()).toBe(401);

    // Verify new password works
    const newLoginAttempt = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testUserEmail, password: 'NewPassword@456' }
    });
    expect(newLoginAttempt.status()).toBe(200);
  });

  test('04. Admin should be able to change user password without old password', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/change-password`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        new_password: 'AdminSet@789'
      }
    });

    expect(response.status()).toBe(200);

    // Verify new password works
    const loginAttempt = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testUserEmail, password: 'AdminSet@789' }
    });
    expect(loginAttempt.status()).toBe(200);
  });

  test('05. Weak password should be rejected', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/change-password`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        new_password: 'weak' // Too short, no special chars, etc.
      }
    });

    expect(response.status()).toBe(422);
  });

  test('06. Password without uppercase should be rejected', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/change-password`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        new_password: 'nouppercase@123'
      }
    });

    expect(response.status()).toBe(422);
  });

  test('07. Password without special character should be rejected', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/change-password`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        new_password: 'NoSpecialChar123'
      }
    });

    expect(response.status()).toBe(422);
  });

  test('08. User changing password with wrong old password should fail', async ({ request }) => {
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testUserEmail, password: 'AdminSet@789' }
    });

    const userToken = (await loginResponse.json()).access_token;

    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/change-password`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
      data: {
        old_password: 'WrongPassword@123',
        new_password: 'NewPassword@999'
      }
    });

    expect(response.status()).toBe(401);
  });

  test('09. Password reuse should be prevented (last 5 passwords)', async ({ request }) => {
    const currentPassword = 'AdminSet@789';

    // Try to reuse current password
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}/change-password`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        new_password: currentPassword
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.detail).toContain('recently used');
  });

  test('10. Rate limiting should prevent brute force attacks', async ({ request }) => {
    // Attempt multiple password resets rapidly
    const requests = [];
    for (let i = 0; i < 6; i++) {
      requests.push(
        request.post(`${BASE_URL}/api/employees/${testUserId}/reset-password`, {
          headers: { 'Authorization': `Bearer ${adminToken}` },
          data: { send_email: false }
        })
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.status() === 429);
    expect(rateLimited).toBeTruthy();
  });
});
