/**
 * Extended Fields Tests
 * Tests: Qualifications, Availability, Hourly Rate, Max Hours
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';

test.describe('Extended Fields API', () => {
  let adminToken: string;
  let testUserId: number;

  test.beforeAll(async ({ request }) => {
    const adminLogin = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: 'admin@example.com', password: 'admin123' }
    });
    adminToken = (await adminLogin.json()).access_token;
  });

  test('01. Create employee with qualifications should succeed', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/employees`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        email: `qualifications.${Date.now()}@example.com`,
        password: 'Test@123456',
        first_name: 'Qualified',
        last_name: 'Employee',
        role: 'employee',
        qualifications: ['JavaScript', 'Python', 'React', 'Node.js']
      }
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    testUserId = data.id;
    expect(data.qualifications).toEqual(['JavaScript', 'Python', 'React', 'Node.js']);
  });

  test('02. Qualifications should be limited to 20 items', async ({ request }) => {
    const tooManyQualifications = Array.from({ length: 21 }, (_, i) => `Skill ${i + 1}`);

    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        qualifications: tooManyQualifications
      }
    });

    expect(response.status()).toBe(422);
  });

  test('03. Add availability schedule should succeed', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        availability: {
          monday: { available: true, start: '09:00', end: '17:00' },
          tuesday: { available: true, start: '09:00', end: '17:00' },
          wednesday: { available: true, start: '09:00', end: '17:00' },
          thursday: { available: true, start: '09:00', end: '17:00' },
          friday: { available: true, start: '09:00', end: '17:00' },
          saturday: { available: false },
          sunday: { available: false }
        }
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.availability.monday.available).toBe(true);
    expect(data.availability.monday.start).toBe('09:00');
    expect(data.availability.saturday.available).toBe(false);
  });

  test('04. Invalid time format should be rejected', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        availability: {
          monday: { available: true, start: '25:00', end: '17:00' } // Invalid hour
        }
      }
    });

    expect(response.status()).toBe(422);
  });

  test('05. Set hourly rate should succeed', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        hourly_rate: 45.75
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.hourly_rate).toBe('45.75');
  });

  test('06. Hourly rate should have 2 decimal precision', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        hourly_rate: 50.12345 // Will be rounded to 2 decimals
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(parseFloat(data.hourly_rate)).toBeCloseTo(50.12, 2);
  });

  test('07. Negative hourly rate should be rejected', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        hourly_rate: -10.00
      }
    });

    expect(response.status()).toBe(422);
  });

  test('08. Hourly rate above 1000 should be rejected', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        hourly_rate: 1001.00
      }
    });

    expect(response.status()).toBe(422);
  });

  test('09. Set max hours per week should succeed', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        max_hours_per_week: 40
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.max_hours_per_week).toBe(40);
  });

  test('10. Max hours should be between 1 and 168', async ({ request }) => {
    // Test below minimum
    let response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { max_hours_per_week: 0 }
    });
    expect(response.status()).toBe(422);

    // Test above maximum
    response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { max_hours_per_week: 169 }
    });
    expect(response.status()).toBe(422);

    // Test valid values
    response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { max_hours_per_week: 1 }
    });
    expect(response.status()).toBe(200);

    response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: { max_hours_per_week: 168 }
    });
    expect(response.status()).toBe(200);
  });

  test('11. Max hours cannot exceed total available hours', async ({ request }) => {
    // Set availability to 8 hours/day * 5 days = 40 hours
    await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        availability: {
          monday: { available: true, start: '09:00', end: '17:00' },
          tuesday: { available: true, start: '09:00', end: '17:00' },
          wednesday: { available: true, start: '09:00', end: '17:00' },
          thursday: { available: true, start: '09:00', end: '17:00' },
          friday: { available: true, start: '09:00', end: '17:00' },
          saturday: { available: false },
          sunday: { available: false }
        }
      }
    });

    // Try to set max_hours to 50 (more than 40 available hours)
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        max_hours_per_week: 50
      }
    });

    expect(response.status()).toBe(422);
  });

  test('12. Update all extended fields together should succeed', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/employees/${testUserId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      data: {
        qualifications: ['TypeScript', 'GraphQL', 'PostgreSQL'],
        availability: {
          monday: { available: true, start: '10:00', end: '18:00' },
          tuesday: { available: true, start: '10:00', end: '18:00' },
          wednesday: { available: true, start: '10:00', end: '18:00' },
          thursday: { available: true, start: '10:00', end: '18:00' },
          friday: { available: true, start: '10:00', end: '18:00' },
          saturday: { available: false },
          sunday: { available: false }
        },
        hourly_rate: 55.00,
        max_hours_per_week: 40
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.qualifications).toEqual(['TypeScript', 'GraphQL', 'PostgreSQL']);
    expect(data.hourly_rate).toBe('55.00');
    expect(data.max_hours_per_week).toBe(40);
  });
});
