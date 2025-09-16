const request = require('supertest');
const { performance } = require('perf_hooks');
const { setupTestEnvironment, teardownTestEnvironment } = require('../setup');
const WebSocket = require('ws');

describe('Performance Integration Tests', () => {
  let app;
  let database;
  let authToken;
  const performanceMetrics = {
    apiResponseTimes: [],
    databaseQueryTimes: [],
    websocketLatency: [],
    concurrentUserResults: [],
    memoryUsage: [],
    cacheHitRates: []
  };

  beforeAll(async () => {
    const setup = await setupTestEnvironment();
    app = setup.app;
    database = setup.database;

    // Authenticate
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin123'
      });

    authToken = loginResponse.body.token;

    // Seed test data for performance testing
    await seedPerformanceTestData();
  }, 60000);

  afterAll(async () => {
    await teardownTestEnvironment(database);
  });

  async function seedPerformanceTestData() {
    // Create 100 employees
    const employees = [];
    for (let i = 1; i <= 100; i++) {
      employees.push({
        name: `Employee ${i}`,
        email: `employee${i}@example.com`,
        position: `Position ${Math.ceil(i / 10)}`,
        department: `Department ${Math.ceil(i / 20)}`,
        hourlyRate: 15 + (i % 10),
        maxHoursPerWeek: 35 + (i % 6),
        availableHours: {
          monday: [{ start: '09:00', end: '17:00' }],
          tuesday: [{ start: '09:00', end: '17:00' }],
          wednesday: [{ start: '09:00', end: '17:00' }],
          thursday: [{ start: '09:00', end: '17:00' }],
          friday: [{ start: '09:00', end: '17:00' }]
        }
      });
    }

    // Batch create employees
    const batchSize = 10;
    for (let i = 0; i < employees.length; i += batchSize) {
      const batch = employees.slice(i, i + batchSize);
      await Promise.all(
        batch.map(employee =>
          request(app)
            .post('/api/employees')
            .set('Authorization', `Bearer ${authToken}`)
            .send(employee)
        )
      );
    }

    // Create 20 schedules with various complexity
    for (let i = 1; i <= 20; i++) {
      const startDate = new Date('2025-09-16');
      startDate.setDate(startDate.getDate() + (i * 7));
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: `Performance Test Schedule ${i}`,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          requirements: {
            minimumStaff: 5 + (i % 3),
            maximumStaff: 15 + (i % 5)
          }
        });
    }
  }

  describe('API Response Time Performance', () => {
    test('Employee list endpoint performance', async () => {
      const iterations = 50;
      const responseTimes = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        const response = await request(app)
          .get('/api/employees?page=1&limit=20')
          .set('Authorization', `Bearer ${authToken}`);

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        expect(response.status).toBe(200);
        responseTimes.push(responseTime);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

      performanceMetrics.apiResponseTimes.push({
        endpoint: 'GET /api/employees',
        avgResponseTime,
        maxResponseTime,
        p95ResponseTime,
        iterations
      });

      // Performance assertions
      expect(avgResponseTime).toBeLessThan(100); // Average < 100ms
      expect(p95ResponseTime).toBeLessThan(200); // 95th percentile < 200ms
      expect(maxResponseTime).toBeLessThan(500); // Max < 500ms

      console.log(`Employee list performance: Avg: ${avgResponseTime.toFixed(2)}ms, P95: ${p95ResponseTime.toFixed(2)}ms, Max: ${maxResponseTime.toFixed(2)}ms`);
    });

    test('Schedule optimization performance', async () => {
      // Create a complex schedule for optimization
      const scheduleResponse = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Complex Optimization Test',
          startDate: '2025-09-16',
          endDate: '2025-09-22',
          requirements: {
            minimumStaff: 10,
            maximumStaff: 25,
            preferredHours: {
              monday: { open: '08:00', close: '22:00' },
              tuesday: { open: '08:00', close: '22:00' },
              wednesday: { open: '08:00', close: '22:00' },
              thursday: { open: '08:00', close: '23:00' },
              friday: { open: '08:00', close: '23:00' },
              saturday: { open: '09:00', close: '21:00' },
              sunday: { open: '10:00', close: '18:00' }
            }
          }
        });

      const scheduleId = scheduleResponse.body.schedule.id;

      const startTime = performance.now();

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

      // Wait for optimization completion
      let optimizationComplete = false;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max

      while (!optimizationComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const statusResponse = await request(app)
          .get(`/api/schedules/${scheduleId}/optimization-status`)
          .set('Authorization', `Bearer ${authToken}`);

        if (statusResponse.body.status === 'completed') {
          optimizationComplete = true;
        }

        attempts++;
      }

      const endTime = performance.now();
      const optimizationTime = endTime - startTime;

      expect(optimizationComplete).toBe(true);
      expect(optimizationTime).toBeLessThan(30000); // Should complete within 30 seconds

      performanceMetrics.apiResponseTimes.push({
        endpoint: 'POST /api/schedules/optimize',
        responseTime: optimizationTime,
        complexity: 'high',
        employees: 100,
        timeSlots: 168 // 7 days * 24 hours
      });

      console.log(`Schedule optimization performance: ${optimizationTime.toFixed(2)}ms for 100 employees over 7 days`);
    });

    test('Bulk operations performance', async () => {
      // Test bulk employee update
      const employeesResponse = await request(app)
        .get('/api/employees?limit=50')
        .set('Authorization', `Bearer ${authToken}`);

      const employees = employeesResponse.body.employees;
      const updates = employees.map(emp => ({
        id: emp.id,
        hourlyRate: emp.hourlyRate + 0.50
      }));

      const startTime = performance.now();

      const bulkUpdateResponse = await request(app)
        .put('/api/employees/bulk-update')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ updates });

      const endTime = performance.now();
      const bulkUpdateTime = endTime - startTime;

      expect(bulkUpdateResponse.status).toBe(200);
      expect(bulkUpdateResponse.body.updated).toBe(employees.length);
      expect(bulkUpdateTime).toBeLessThan(2000); // Should complete within 2 seconds

      performanceMetrics.apiResponseTimes.push({
        endpoint: 'PUT /api/employees/bulk-update',
        responseTime: bulkUpdateTime,
        recordsUpdated: employees.length
      });

      console.log(`Bulk update performance: ${bulkUpdateTime.toFixed(2)}ms for ${employees.length} employees`);
    });
  });

  describe('Database Query Performance', () => {
    test('Complex queries with joins and aggregations', async () => {
      const queries = [
        {
          name: 'Employee schedule summary',
          endpoint: '/api/reports/employee-schedule-summary?startDate=2025-09-01&endDate=2025-09-30'
        },
        {
          name: 'Department labor costs',
          endpoint: '/api/reports/department-costs?period=monthly'
        },
        {
          name: 'Schedule conflicts analysis',
          endpoint: '/api/schedules/conflicts-analysis?lookAhead=30'
        },
        {
          name: 'Employee availability matrix',
          endpoint: '/api/employees/availability-matrix?weekStarting=2025-09-16'
        }
      ];

      for (const query of queries) {
        const queryTimes = [];
        const iterations = 10;

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();

          const response = await request(app)
            .get(query.endpoint)
            .set('Authorization', `Bearer ${authToken}`);

          const endTime = performance.now();
          const queryTime = endTime - startTime;

          expect(response.status).toBe(200);
          queryTimes.push(queryTime);
        }

        const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
        const maxQueryTime = Math.max(...queryTimes);

        performanceMetrics.databaseQueryTimes.push({
          queryName: query.name,
          avgQueryTime,
          maxQueryTime,
          iterations
        });

        expect(avgQueryTime).toBeLessThan(500); // Average query time < 500ms
        expect(maxQueryTime).toBeLessThan(1000); // Max query time < 1000ms

        console.log(`${query.name} performance: Avg: ${avgQueryTime.toFixed(2)}ms, Max: ${maxQueryTime.toFixed(2)}ms`);
      }
    });

    test('Pagination performance with large datasets', async () => {
      const pageSize = 20;
      const totalPages = 5;
      const pageTimes = [];

      for (let page = 1; page <= totalPages; page++) {
        const startTime = performance.now();

        const response = await request(app)
          .get(`/api/employees?page=${page}&limit=${pageSize}&sortBy=name&sortOrder=asc`)
          .set('Authorization', `Bearer ${authToken}`);

        const endTime = performance.now();
        const pageTime = endTime - startTime;

        expect(response.status).toBe(200);
        expect(response.body.employees).toHaveLength(pageSize);

        pageTimes.push({ page, time: pageTime });
      }

      const avgPageTime = pageTimes.reduce((sum, p) => sum + p.time, 0) / pageTimes.length;
      const timeVariance = Math.max(...pageTimes.map(p => p.time)) - Math.min(...pageTimes.map(p => p.time));

      performanceMetrics.databaseQueryTimes.push({
        queryName: 'Pagination performance',
        avgPageTime,
        timeVariance,
        pages: totalPages
      });

      expect(avgPageTime).toBeLessThan(150); // Average page load < 150ms
      expect(timeVariance).toBeLessThan(100); // Time variance < 100ms (consistent performance)

      console.log(`Pagination performance: Avg: ${avgPageTime.toFixed(2)}ms, Variance: ${timeVariance.toFixed(2)}ms`);
    });
  });

  describe('WebSocket Performance & Scalability', () => {
    test('WebSocket connection latency', async () => {
      const connectionTimes = [];
      const messageTimes = [];
      const connections = 10;

      for (let i = 0; i < connections; i++) {
        const connectStart = performance.now();

        const ws = new WebSocket(`ws://localhost:${process.env.PORT || 8000}/ws?token=${authToken}`);

        await new Promise((resolve, reject) => {
          ws.on('open', () => {
            const connectEnd = performance.now();
            connectionTimes.push(connectEnd - connectStart);

            // Test message round-trip time
            const messageStart = performance.now();
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));

            ws.on('message', (data) => {
              const message = JSON.parse(data.toString());
              if (message.type === 'pong') {
                const messageEnd = performance.now();
                messageTimes.push(messageEnd - messageStart);
                ws.close();
                resolve();
              }
            });
          });

          ws.on('error', reject);

          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
      }

      const avgConnectionTime = connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length;
      const avgMessageTime = messageTimes.reduce((a, b) => a + b, 0) / messageTimes.length;

      performanceMetrics.websocketLatency.push({
        avgConnectionTime,
        avgMessageTime,
        connections
      });

      expect(avgConnectionTime).toBeLessThan(100); // Connection time < 100ms
      expect(avgMessageTime).toBeLessThan(50); // Message round-trip < 50ms

      console.log(`WebSocket performance: Connection: ${avgConnectionTime.toFixed(2)}ms, Message RT: ${avgMessageTime.toFixed(2)}ms`);
    });

    test('Concurrent WebSocket message broadcasting', async () => {
      const connections = 20;
      const messagesPerConnection = 5;
      const clients = [];
      const receivedMessages = [];

      // Create multiple WebSocket connections
      for (let i = 0; i < connections; i++) {
        const ws = new WebSocket(`ws://localhost:${process.env.PORT || 8000}/ws?token=${authToken}`);
        clients.push(ws);

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'broadcast_test') {
            receivedMessages.push({
              clientId: i,
              messageId: message.messageId,
              receivedAt: performance.now()
            });
          }
        });

        await new Promise((resolve) => {
          ws.on('open', resolve);
        });

        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'broadcast_test'
        }));
      }

      // Send broadcast messages
      const broadcastStart = performance.now();

      for (let i = 0; i < messagesPerConnection; i++) {
        await request(app)
          .post('/api/websocket/broadcast')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            channel: 'broadcast_test',
            type: 'broadcast_test',
            messageId: i,
            data: { test: `message_${i}` }
          });

        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between messages
      }

      // Wait for all messages to be received
      await new Promise(resolve => setTimeout(resolve, 2000));

      const broadcastEnd = performance.now();
      const totalBroadcastTime = broadcastEnd - broadcastStart;

      // Clean up connections
      clients.forEach(ws => ws.close());

      const expectedMessages = connections * messagesPerConnection;
      const deliveryRate = (receivedMessages.length / expectedMessages) * 100;

      performanceMetrics.websocketLatency.push({
        broadcastTime: totalBroadcastTime,
        messagesDelivered: receivedMessages.length,
        expectedMessages,
        deliveryRate,
        connections
      });

      expect(deliveryRate).toBeGreaterThan(95); // 95% delivery rate
      expect(totalBroadcastTime).toBeLessThan(10000); // Complete within 10 seconds

      console.log(`Broadcast performance: ${deliveryRate.toFixed(1)}% delivery rate, ${totalBroadcastTime.toFixed(2)}ms total time`);
    });
  });

  describe('Concurrent User Load Testing', () => {
    test('100 concurrent users - mixed operations', async () => {
      const concurrentUsers = 100;
      const operationsPerUser = 5;
      const operations = [
        () => request(app).get('/api/employees').set('Authorization', `Bearer ${authToken}`),
        () => request(app).get('/api/schedules').set('Authorization', `Bearer ${authToken}`),
        () => request(app).get('/api/rules').set('Authorization', `Bearer ${authToken}`),
        () => request(app).post('/api/employees').set('Authorization', `Bearer ${authToken}`).send({
          name: `Concurrent User ${Math.random()}`,
          email: `concurrent${Math.random()}@example.com`,
          position: 'Test Position',
          department: 'Test Department',
          hourlyRate: 15,
          maxHoursPerWeek: 40,
          availableHours: {}
        }),
        () => request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${authToken}`)
      ];

      const userPromises = [];

      for (let user = 0; user < concurrentUsers; user++) {
        const userOperations = [];

        for (let op = 0; op < operationsPerUser; op++) {
          const randomOperation = operations[Math.floor(Math.random() * operations.length)];
          userOperations.push(randomOperation());
        }

        userPromises.push(
          Promise.all(userOperations).then(responses => ({
            userId: user,
            responses: responses.map(r => ({
              status: r.status,
              responseTime: r.duration || 0
            })),
            totalTime: Date.now()
          }))
        );
      }

      const loadTestStart = performance.now();
      const results = await Promise.all(userPromises);
      const loadTestEnd = performance.now();

      const totalLoadTime = loadTestEnd - loadTestStart;
      const successfulOperations = results.reduce((count, user) =>
        count + user.responses.filter(r => r.status < 400).length, 0
      );
      const totalOperations = concurrentUsers * operationsPerUser;
      const successRate = (successfulOperations / totalOperations) * 100;

      const errorResponses = results.reduce((errors, user) =>
        errors + user.responses.filter(r => r.status >= 400).length, 0
      );

      performanceMetrics.concurrentUserResults.push({
        concurrentUsers,
        operationsPerUser,
        totalOperations,
        successfulOperations,
        errorResponses,
        successRate,
        totalLoadTime,
        avgOperationsPerSecond: totalOperations / (totalLoadTime / 1000)
      });

      expect(successRate).toBeGreaterThan(95); // 95% success rate
      expect(totalLoadTime).toBeLessThan(30000); // Complete within 30 seconds
      expect(errorResponses).toBeLessThan(totalOperations * 0.05); // Less than 5% errors

      console.log(`Load test results: ${successRate.toFixed(1)}% success rate, ${(totalLoadTime / 1000).toFixed(2)}s total time, ${errorResponses} errors`);
    });

    test('Database connection pool under load', async () => {
      const concurrentQueries = 50;
      const queryPromises = [];

      // Generate concurrent database-intensive operations
      for (let i = 0; i < concurrentQueries; i++) {
        queryPromises.push(
          request(app)
            .get('/api/reports/detailed-schedule-analysis?includeMetrics=true')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const queryStart = performance.now();
      const results = await Promise.all(queryPromises);
      const queryEnd = performance.now();

      const queryTime = queryEnd - queryStart;
      const successfulQueries = results.filter(r => r.status === 200).length;
      const avgQueryTime = queryTime / concurrentQueries;

      performanceMetrics.databaseQueryTimes.push({
        queryName: 'Concurrent connection pool test',
        concurrentQueries,
        successfulQueries,
        totalTime: queryTime,
        avgQueryTime,
        successRate: (successfulQueries / concurrentQueries) * 100
      });

      expect(successfulQueries).toBe(concurrentQueries); // All queries should succeed
      expect(avgQueryTime).toBeLessThan(1000); // Average query time < 1000ms

      console.log(`Database pool performance: ${successfulQueries}/${concurrentQueries} success, ${avgQueryTime.toFixed(2)}ms avg time`);
    });
  });

  describe('Memory Usage & Cache Performance', () => {
    test('Memory usage monitoring during operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform memory-intensive operations
      const operations = [
        // Large data export
        request(app)
          .get('/api/schedules/export?format=json&includeDetails=true')
          .set('Authorization', `Bearer ${authToken}`),

        // Complex report generation
        request(app)
          .get('/api/reports/comprehensive-analysis?period=quarterly')
          .set('Authorization', `Bearer ${authToken}`),

        // Bulk operations
        request(app)
          .post('/api/employees/bulk-operations')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            operation: 'analyze',
            employeeIds: Array.from({ length: 50 }, (_, i) => i + 1)
          })
      ];

      await Promise.all(operations);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = {
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
        external: finalMemory.external - initialMemory.external,
        rss: finalMemory.rss - initialMemory.rss
      };

      performanceMetrics.memoryUsage.push({
        initialMemory,
        finalMemory,
        memoryIncrease,
        increasePercentage: {
          heap: (memoryIncrease.heapUsed / initialMemory.heapUsed) * 100,
          total: (memoryIncrease.heapTotal / initialMemory.heapTotal) * 100
        }
      });

      // Memory increase should be reasonable
      expect(memoryIncrease.heapUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
      expect(memoryIncrease.heapUsed / initialMemory.heapUsed).toBeLessThan(2); // Less than 2x increase

      console.log(`Memory usage: +${(memoryIncrease.heapUsed / 1024 / 1024).toFixed(2)}MB heap, +${(memoryIncrease.rss / 1024 / 1024).toFixed(2)}MB RSS`);
    });

    test('Cache effectiveness and hit rates', async () => {
      // Clear cache first
      await request(app)
        .post('/api/cache/clear')
        .set('Authorization', `Bearer ${authToken}`);

      const endpoints = [
        '/api/employees?department=Sales',
        '/api/schedules?status=published',
        '/api/rules?active=true',
        '/api/dashboard/stats'
      ];

      const cacheResults = [];

      for (const endpoint of endpoints) {
        // First request (cache miss)
        const firstStart = performance.now();
        const firstResponse = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`);
        const firstTime = performance.now() - firstStart;

        // Second request (cache hit)
        const secondStart = performance.now();
        const secondResponse = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`);
        const secondTime = performance.now() - secondStart;

        // Third request (cache hit)
        const thirdStart = performance.now();
        const thirdResponse = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`);
        const thirdTime = performance.now() - thirdStart;

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);
        expect(thirdResponse.status).toBe(200);

        const avgCacheHitTime = (secondTime + thirdTime) / 2;
        const speedImprovement = ((firstTime - avgCacheHitTime) / firstTime) * 100;

        cacheResults.push({
          endpoint,
          cacheMissTime: firstTime,
          avgCacheHitTime,
          speedImprovement
        });

        expect(avgCacheHitTime).toBeLessThan(firstTime * 0.5); // Cache should be at least 50% faster
      }

      performanceMetrics.cacheHitRates.push({
        endpoints: cacheResults,
        avgSpeedImprovement: cacheResults.reduce((sum, r) => sum + r.speedImprovement, 0) / cacheResults.length
      });

      const avgImprovement = cacheResults.reduce((sum, r) => sum + r.speedImprovement, 0) / cacheResults.length;
      expect(avgImprovement).toBeGreaterThan(30); // At least 30% improvement

      console.log(`Cache performance: ${avgImprovement.toFixed(1)}% average speed improvement`);
    });
  });

  describe('File Upload/Download Performance', () => {
    test('Large file upload performance', async () => {
      // Create a test CSV file with 1000 employee records
      const csvData = ['name,email,position,department,hourlyRate,maxHoursPerWeek'];
      for (let i = 1; i <= 1000; i++) {
        csvData.push(`Employee ${i},employee${i}@test.com,Position ${i % 10},Department ${i % 5},${15 + (i % 10)},${35 + (i % 6)}`);
      }
      const csvContent = csvData.join('\n');
      const fileSize = Buffer.byteLength(csvContent, 'utf8');

      const uploadStart = performance.now();

      const uploadResponse = await request(app)
        .post('/api/employees/import')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(csvContent), 'large_employee_import.csv');

      const uploadEnd = performance.now();
      const uploadTime = uploadEnd - uploadStart;

      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.body.imported).toBeGreaterThan(900); // At least 90% success

      const uploadSpeedMBps = (fileSize / 1024 / 1024) / (uploadTime / 1000);

      performanceMetrics.apiResponseTimes.push({
        endpoint: 'POST /api/employees/import (large file)',
        responseTime: uploadTime,
        fileSize,
        uploadSpeedMBps,
        recordsProcessed: uploadResponse.body.imported
      });

      expect(uploadTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(uploadSpeedMBps).toBeGreaterThan(0.1); // At least 0.1 MB/s

      console.log(`File upload performance: ${uploadTime.toFixed(2)}ms for ${(fileSize / 1024).toFixed(1)}KB (${uploadSpeedMBps.toFixed(2)} MB/s)`);
    });

    test('Export performance with large datasets', async () => {
      const formats = ['csv', 'excel', 'json'];
      const exportResults = [];

      for (const format of formats) {
        const exportStart = performance.now();

        const exportResponse = await request(app)
          .get(`/api/schedules/export?format=${format}&startDate=2025-01-01&endDate=2025-12-31&includeDetails=true`)
          .set('Authorization', `Bearer ${authToken}`);

        const exportEnd = performance.now();
        const exportTime = exportEnd - exportStart;

        expect(exportResponse.status).toBe(200);

        const responseSize = Buffer.byteLength(exportResponse.text || JSON.stringify(exportResponse.body));
        const exportSpeedMBps = (responseSize / 1024 / 1024) / (exportTime / 1000);

        exportResults.push({
          format,
          exportTime,
          responseSize,
          exportSpeedMBps
        });

        expect(exportTime).toBeLessThan(15000); // Should complete within 15 seconds

        console.log(`${format.toUpperCase()} export: ${exportTime.toFixed(2)}ms, ${(responseSize / 1024).toFixed(1)}KB`);
      }

      performanceMetrics.apiResponseTimes.push({
        endpoint: 'GET /api/schedules/export (large dataset)',
        exportResults
      });
    });
  });

  afterAll(() => {
    // Log comprehensive performance summary
    console.log('\n=== PERFORMANCE TEST SUMMARY ===');
    console.log(JSON.stringify(performanceMetrics, null, 2));
  });
});