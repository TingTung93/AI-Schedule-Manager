const request = require('supertest');
const { setupTestEnvironment, teardownTestEnvironment } = require('../setup');
const WebSocket = require('ws');
const nodemailer = require('nodemailer');

describe('Comprehensive Integration Tests', () => {
  let app;
  let database;
  let testUser;
  let authToken;
  let wsClient;

  beforeAll(async () => {
    // Setup test environment
    const setup = await setupTestEnvironment();
    app = setup.app;
    database = setup.database;

    // Create test user and authenticate
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPass123!',
        role: 'admin'
      });

    testUser = userResponse.body.user;

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'TestPass123!'
      });

    authToken = loginResponse.body.token;
  }, 30000);

  afterAll(async () => {
    if (wsClient) {
      wsClient.close();
    }
    await teardownTestEnvironment(database);
  });

  describe('1. User Authentication & Authorization Workflows', () => {
    test('Complete user registration flow', async () => {
      const userData = {
        name: 'New User',
        email: 'newuser@example.com',
        password: 'NewPass123!',
        role: 'manager'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.token).toBeDefined();

      // Verify user can login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.token).toBeDefined();
    });

    test('Password reset workflow', async () => {
      // Request password reset
      const resetResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(resetResponse.status).toBe(200);

      // Verify reset token is generated (would check email in real scenario)
      const user = await database.query(
        'SELECT reset_token FROM users WHERE email = ?',
        ['test@example.com']
      );

      expect(user[0].reset_token).toBeDefined();
    });

    test('Authorization checks across endpoints', async () => {
      // Test unauthorized access
      const unauthorizedResponse = await request(app)
        .get('/api/employees');

      expect(unauthorizedResponse.status).toBe(401);

      // Test authorized access
      const authorizedResponse = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${authToken}`);

      expect(authorizedResponse.status).toBe(200);
    });
  });

  describe('2. Employee Management CRUD Operations', () => {
    let employeeId;

    test('Create employee with validation', async () => {
      const employeeData = {
        name: 'John Doe',
        email: 'john@example.com',
        position: 'Sales Associate',
        department: 'Sales',
        hourlyRate: 15.50,
        maxHoursPerWeek: 40,
        availableHours: {
          monday: [{ start: '09:00', end: '17:00' }],
          tuesday: [{ start: '09:00', end: '17:00' }],
          wednesday: [{ start: '09:00', end: '17:00' }],
          thursday: [{ start: '09:00', end: '17:00' }],
          friday: [{ start: '09:00', end: '17:00' }]
        }
      };

      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send(employeeData);

      expect(response.status).toBe(201);
      expect(response.body.employee.name).toBe(employeeData.name);
      expect(response.body.employee.email).toBe(employeeData.email);

      employeeId = response.body.employee.id;
    });

    test('Retrieve and update employee', async () => {
      // Get employee
      const getResponse = await request(app)
        .get(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.employee.name).toBe('John Doe');

      // Update employee
      const updateData = {
        position: 'Senior Sales Associate',
        hourlyRate: 18.00
      };

      const updateResponse = await request(app)
        .put(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.employee.position).toBe(updateData.position);
      expect(updateResponse.body.employee.hourlyRate).toBe(updateData.hourlyRate);
    });

    test('Employee list with pagination and filtering', async () => {
      // Create additional employees for testing
      const employees = [
        { name: 'Jane Smith', email: 'jane@example.com', department: 'Marketing', position: 'Marketing Specialist' },
        { name: 'Bob Johnson', email: 'bob@example.com', department: 'Sales', position: 'Sales Manager' }
      ];

      for (const emp of employees) {
        await request(app)
          .post('/api/employees')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...emp,
            hourlyRate: 20,
            maxHoursPerWeek: 40,
            availableHours: {}
          });
      }

      // Test pagination
      const paginatedResponse = await request(app)
        .get('/api/employees?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(paginatedResponse.status).toBe(200);
      expect(paginatedResponse.body.employees).toHaveLength(2);
      expect(paginatedResponse.body.totalPages).toBeGreaterThan(1);

      // Test filtering
      const filteredResponse = await request(app)
        .get('/api/employees?department=Sales')
        .set('Authorization', `Bearer ${authToken}`);

      expect(filteredResponse.status).toBe(200);
      expect(filteredResponse.body.employees.every(emp => emp.department === 'Sales')).toBe(true);
    });
  });

  describe('3. Schedule Creation & Optimization', () => {
    let scheduleId;

    test('Create schedule with constraints', async () => {
      const scheduleData = {
        name: 'Weekly Schedule - Week 1',
        startDate: '2025-09-16',
        endDate: '2025-09-22',
        requirements: {
          minimumStaff: 2,
          maximumStaff: 5,
          preferredHours: {
            monday: { open: '09:00', close: '18:00' },
            tuesday: { open: '09:00', close: '18:00' },
            wednesday: { open: '09:00', close: '18:00' },
            thursday: { open: '09:00', close: '20:00' },
            friday: { open: '09:00', close: '20:00' },
            saturday: { open: '10:00', close: '16:00' }
          }
        }
      };

      const response = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(scheduleData);

      expect(response.status).toBe(201);
      expect(response.body.schedule.name).toBe(scheduleData.name);
      expect(response.body.schedule.status).toBe('draft');

      scheduleId = response.body.schedule.id;
    });

    test('AI optimization process', async () => {
      const optimizationResponse = await request(app)
        .post(`/api/schedules/${scheduleId}/optimize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          algorithm: 'genetic',
          constraints: {
            fairnessWeight: 0.7,
            costWeight: 0.3,
            availabilityWeight: 1.0
          }
        });

      expect(optimizationResponse.status).toBe(200);
      expect(optimizationResponse.body.optimizationJob).toBeDefined();

      // Poll for optimization completion
      let optimizationComplete = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!optimizationComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const statusResponse = await request(app)
          .get(`/api/schedules/${scheduleId}/optimization-status`)
          .set('Authorization', `Bearer ${authToken}`);

        if (statusResponse.body.status === 'completed') {
          optimizationComplete = true;
          expect(statusResponse.body.result.efficiency).toBeGreaterThan(0);
        }

        attempts++;
      }

      expect(optimizationComplete).toBe(true);
    });

    test('Schedule conflicts detection and resolution', async () => {
      // Create conflicting schedule
      const conflictScheduleData = {
        name: 'Conflicting Schedule',
        startDate: '2025-09-16',
        endDate: '2025-09-22',
        shifts: [
          {
            employeeId: 1,
            startTime: '2025-09-16T09:00:00Z',
            endTime: '2025-09-16T17:00:00Z'
          },
          {
            employeeId: 1, // Same employee, overlapping time
            startTime: '2025-09-16T15:00:00Z',
            endTime: '2025-09-16T23:00:00Z'
          }
        ]
      };

      const response = await request(app)
        .post('/api/schedules/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(conflictScheduleData);

      expect(response.status).toBe(400);
      expect(response.body.conflicts).toBeDefined();
      expect(response.body.conflicts).toHaveLength(1);
      expect(response.body.conflicts[0].type).toBe('employee_overlap');
    });
  });

  describe('4. Rule Management & Validation', () => {
    let ruleId;

    test('Create business rules', async () => {
      const ruleData = {
        name: 'Minimum Rest Between Shifts',
        type: 'constraint',
        description: 'Employees must have at least 8 hours between shifts',
        conditions: {
          minRestHours: 8,
          appliesTo: 'all_employees'
        },
        active: true,
        priority: 1
      };

      const response = await request(app)
        .post('/api/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ruleData);

      expect(response.status).toBe(201);
      expect(response.body.rule.name).toBe(ruleData.name);
      expect(response.body.rule.active).toBe(true);

      ruleId = response.body.rule.id;
    });

    test('Rule validation in scheduling', async () => {
      const scheduleData = {
        name: 'Rule Validation Test',
        startDate: '2025-09-16',
        endDate: '2025-09-17',
        shifts: [
          {
            employeeId: 1,
            startTime: '2025-09-16T08:00:00Z',
            endTime: '2025-09-16T16:00:00Z'
          },
          {
            employeeId: 1,
            startTime: '2025-09-16T20:00:00Z', // Only 4 hours rest - should violate rule
            endTime: '2025-09-17T04:00:00Z'
          }
        ]
      };

      const response = await request(app)
        .post('/api/schedules/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(scheduleData);

      expect(response.status).toBe(400);
      expect(response.body.ruleViolations).toBeDefined();
      expect(response.body.ruleViolations.some(v => v.ruleId === ruleId)).toBe(true);
    });

    test('Rule updates and cascading effects', async () => {
      const updateData = {
        conditions: {
          minRestHours: 12, // Increase rest requirement
          appliesTo: 'all_employees'
        }
      };

      const response = await request(app)
        .put(`/api/rules/${ruleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.rule.conditions.minRestHours).toBe(12);

      // Test that existing schedules are re-validated
      const revalidationResponse = await request(app)
        .post('/api/schedules/revalidate-all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(revalidationResponse.status).toBe(200);
      expect(revalidationResponse.body.affectedSchedules).toBeGreaterThan(0);
    });
  });

  describe('5. Real-time WebSocket Communication', () => {
    test('WebSocket connection and real-time updates', (done) => {
      const wsUrl = `ws://localhost:${process.env.PORT || 8000}/ws?token=${authToken}`;
      wsClient = new WebSocket(wsUrl);

      wsClient.on('open', () => {
        // Subscribe to schedule updates
        wsClient.send(JSON.stringify({
          type: 'subscribe',
          channel: 'schedule_updates'
        }));

        // Create a schedule to trigger update
        request(app)
          .post('/api/schedules')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'WebSocket Test Schedule',
            startDate: '2025-09-16',
            endDate: '2025-09-22'
          })
          .end((err, res) => {
            expect(err).toBeNull();
            expect(res.status).toBe(201);
          });
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'schedule_created') {
          expect(message.data.schedule.name).toBe('WebSocket Test Schedule');
          done();
        }
      });

      wsClient.on('error', (error) => {
        done(error);
      });
    }, 10000);

    test('Real-time notifications delivery', (done) => {
      wsClient.send(JSON.stringify({
        type: 'subscribe',
        channel: 'notifications'
      }));

      // Trigger a notification
      request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'schedule_published',
          recipient: testUser.id,
          message: 'Your schedule has been published'
        })
        .end();

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'notification') {
          expect(message.data.type).toBe('schedule_published');
          expect(message.data.recipient).toBe(testUser.id);
          done();
        }
      });
    }, 5000);
  });

  describe('6. Email Notification System', () => {
    test('Email queue and delivery', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Schedule Update',
        template: 'schedule_notification',
        data: {
          employeeName: 'Test User',
          scheduleDate: '2025-09-16',
          shifts: []
        }
      };

      const response = await request(app)
        .post('/api/notifications/email')
        .set('Authorization', `Bearer ${authToken}`)
        .send(emailData);

      expect(response.status).toBe(200);
      expect(response.body.messageId).toBeDefined();

      // Check email queue status
      const queueResponse = await request(app)
        .get('/api/notifications/email/queue-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(queueResponse.status).toBe(200);
      expect(queueResponse.body.pendingEmails).toBeGreaterThanOrEqual(0);
    });

    test('Email template rendering', async () => {
      const templateResponse = await request(app)
        .post('/api/notifications/email/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          template: 'schedule_notification',
          data: {
            employeeName: 'John Doe',
            scheduleDate: '2025-09-16',
            shifts: [
              {
                date: '2025-09-16',
                startTime: '09:00',
                endTime: '17:00',
                position: 'Sales Associate'
              }
            ]
          }
        });

      expect(templateResponse.status).toBe(200);
      expect(templateResponse.body.html).toContain('John Doe');
      expect(templateResponse.body.html).toContain('09:00');
      expect(templateResponse.body.text).toContain('Sales Associate');
    });

    test('Email unsubscribe functionality', async () => {
      // Generate unsubscribe token
      const unsubscribeResponse = await request(app)
        .post('/api/notifications/email/unsubscribe-token')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'test@example.com' });

      expect(unsubscribeResponse.status).toBe(200);
      expect(unsubscribeResponse.body.token).toBeDefined();

      // Use token to unsubscribe
      const token = unsubscribeResponse.body.token;
      const confirmResponse = await request(app)
        .post(`/api/notifications/email/unsubscribe/${token}`)
        .send();

      expect(confirmResponse.status).toBe(200);
      expect(confirmResponse.body.success).toBe(true);

      // Verify user is unsubscribed
      const statusResponse = await request(app)
        .get('/api/notifications/email/subscription-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.subscribed).toBe(false);
    });
  });

  describe('7. Data Export/Import Operations', () => {
    test('Export schedules to multiple formats', async () => {
      // Test CSV export
      const csvResponse = await request(app)
        .get('/api/schedules/export?format=csv&startDate=2025-09-01&endDate=2025-09-30')
        .set('Authorization', `Bearer ${authToken}`);

      expect(csvResponse.status).toBe(200);
      expect(csvResponse.headers['content-type']).toContain('text/csv');
      expect(csvResponse.text).toContain('Employee Name,Date,Start Time,End Time');

      // Test Excel export
      const excelResponse = await request(app)
        .get('/api/schedules/export?format=excel&startDate=2025-09-01&endDate=2025-09-30')
        .set('Authorization', `Bearer ${authToken}`);

      expect(excelResponse.status).toBe(200);
      expect(excelResponse.headers['content-type']).toContain('application/vnd.openxmlformats');

      // Test JSON export
      const jsonResponse = await request(app)
        .get('/api/schedules/export?format=json&startDate=2025-09-01&endDate=2025-09-30')
        .set('Authorization', `Bearer ${authToken}`);

      expect(jsonResponse.status).toBe(200);
      expect(jsonResponse.body.schedules).toBeDefined();
      expect(Array.isArray(jsonResponse.body.schedules)).toBe(true);
    });

    test('Import employee data with validation', async () => {
      const csvData = `name,email,position,department,hourlyRate,maxHoursPerWeek
Import User 1,import1@example.com,Cashier,Retail,14.50,35
Import User 2,import2@example.com,Manager,Retail,22.00,40
Invalid User,,Invalid Position,Sales,invalid_rate,50`;

      const response = await request(app)
        .post('/api/employees/import')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(csvData), 'employees.csv');

      expect(response.status).toBe(200);
      expect(response.body.imported).toBe(2);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0]).toContain('Invalid User');

      // Verify imported employees exist
      const employeesResponse = await request(app)
        .get('/api/employees?search=Import User')
        .set('Authorization', `Bearer ${authToken}`);

      expect(employeesResponse.status).toBe(200);
      expect(employeesResponse.body.employees).toHaveLength(2);
    });

    test('Backup and restore operations', async () => {
      // Create backup
      const backupResponse = await request(app)
        .post('/api/backup/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          includeData: ['employees', 'schedules', 'rules'],
          compression: true
        });

      expect(backupResponse.status).toBe(200);
      expect(backupResponse.body.backupId).toBeDefined();
      expect(backupResponse.body.filePath).toBeDefined();

      const backupId = backupResponse.body.backupId;

      // List backups
      const listResponse = await request(app)
        .get('/api/backup/list')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.backups.some(b => b.id === backupId)).toBe(true);

      // Download backup
      const downloadResponse = await request(app)
        .get(`/api/backup/download/${backupId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers['content-type']).toContain('application/octet-stream');

      // Test restore validation (without actually restoring)
      const restoreValidationResponse = await request(app)
        .post(`/api/backup/validate-restore/${backupId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(restoreValidationResponse.status).toBe(200);
      expect(restoreValidationResponse.body.valid).toBe(true);
      expect(restoreValidationResponse.body.summary).toBeDefined();
    });
  });

  describe('8. Error Handling & Recovery', () => {
    test('API error responses and logging', async () => {
      // Test 404 handling
      const notFoundResponse = await request(app)
        .get('/api/employees/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(notFoundResponse.status).toBe(404);
      expect(notFoundResponse.body.error).toBeDefined();
      expect(notFoundResponse.body.requestId).toBeDefined();

      // Test validation errors
      const validationResponse = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' }); // Invalid data

      expect(validationResponse.status).toBe(400);
      expect(validationResponse.body.errors).toBeDefined();
      expect(Array.isArray(validationResponse.body.errors)).toBe(true);

      // Test server error handling
      const serverErrorResponse = await request(app)
        .post('/api/test/trigger-error')
        .set('Authorization', `Bearer ${authToken}`);

      expect(serverErrorResponse.status).toBe(500);
      expect(serverErrorResponse.body.error).toBe('Internal server error');
      expect(serverErrorResponse.body.requestId).toBeDefined();
    });

    test('Database transaction rollback', async () => {
      // Attempt to create schedule with invalid employee reference
      const invalidScheduleData = {
        name: 'Invalid Schedule',
        startDate: '2025-09-16',
        endDate: '2025-09-22',
        shifts: [
          {
            employeeId: 99999, // Non-existent employee
            startTime: '2025-09-16T09:00:00Z',
            endTime: '2025-09-16T17:00:00Z'
          }
        ]
      };

      const response = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidScheduleData);

      expect(response.status).toBe(400);

      // Verify no partial data was created
      const schedulesResponse = await request(app)
        .get('/api/schedules?search=Invalid Schedule')
        .set('Authorization', `Bearer ${authToken}`);

      expect(schedulesResponse.body.schedules).toHaveLength(0);
    });

    test('Rate limiting enforcement', async () => {
      const requests = [];

      // Make multiple rapid requests
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .get('/api/employees')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses[0].body.error).toContain('rate limit');
    });
  });
});