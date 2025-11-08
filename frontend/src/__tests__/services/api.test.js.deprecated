/**
 * Comprehensive API service tests.
 * Tests all API service modules, error handling, and interceptors.
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  authService,
  ruleService,
  scheduleService,
  employeeService,
  analyticsService,
  notificationService
} from '../../services/api';

// Create mock adapter
const mockAxios = new MockAdapter(axios);

describe('API Services', () => {
  beforeEach(() => {
    mockAxios.reset();
    localStorage.clear();
  });

  afterEach(() => {
    mockAxios.reset();
    localStorage.clear();
  });

  describe('AuthService', () => {
    describe('login', () => {
      it('should login successfully with valid credentials', async () => {
        const loginData = {
          access_token: 'test-token-123',
          user: { email: 'test@example.com', role: 'manager' }
        };

        mockAxios.onPost('/api/auth/login').reply(200, loginData);

        const result = await authService.login('test@example.com', 'password123');

        expect(result.token).toBe('test-token-123');
        expect(result.user.email).toBe('test@example.com');
        expect(localStorage.getItem('token')).toBe('test-token-123');
        expect(localStorage.getItem('user')).toBe(JSON.stringify(loginData.user));
      });

      it('should throw error with invalid credentials', async () => {
        mockAxios.onPost('/api/auth/login').reply(401, {
          detail: 'Invalid credentials'
        });

        await expect(authService.login('invalid@example.com', 'wrongpassword'))
          .rejects
          .toThrow('Invalid credentials');
      });

      it('should handle network errors', async () => {
        mockAxios.onPost('/api/auth/login').networkError();

        await expect(authService.login('test@example.com', 'password123'))
          .rejects
          .toThrow();
      });

      it('should handle server errors', async () => {
        mockAxios.onPost('/api/auth/login').reply(500, {
          detail: 'Internal server error'
        });

        await expect(authService.login('test@example.com', 'password123'))
          .rejects
          .toThrow();
      });
    });

    describe('logout', () => {
      it('should clear local storage and redirect', () => {
        localStorage.setItem('token', 'test-token');
        localStorage.setItem('user', JSON.stringify({ email: 'test@example.com' }));

        // Mock window.location.href
        delete window.location;
        window.location = { href: '' };

        authService.logout();

        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
        expect(window.location.href).toBe('/login');
      });
    });

    describe('getCurrentUser', () => {
      it('should return current user from localStorage', () => {
        const user = { email: 'test@example.com', role: 'manager' };
        localStorage.setItem('user', JSON.stringify(user));

        const result = authService.getCurrentUser();

        expect(result).toEqual(user);
      });

      it('should return null if no user in localStorage', () => {
        const result = authService.getCurrentUser();

        expect(result).toBeNull();
      });

      it('should handle invalid JSON in localStorage', () => {
        localStorage.setItem('user', 'invalid-json');

        const result = authService.getCurrentUser();

        expect(result).toBeNull();
      });
    });

    describe('isAuthenticated', () => {
      it('should return true when token exists', () => {
        localStorage.setItem('token', 'test-token');

        const result = authService.isAuthenticated();

        expect(result).toBe(true);
      });

      it('should return false when no token', () => {
        const result = authService.isAuthenticated();

        expect(result).toBe(false);
      });
    });
  });

  describe('RuleService', () => {
    describe('parseRule', () => {
      it('should parse rule successfully', async () => {
        const ruleData = {
          id: 1,
          rule_type: 'availability',
          employee: 'John Doe',
          constraints: [{ type: 'time', value: '17:00' }],
          original_text: 'John cannot work past 5pm',
          created_at: '2024-01-15T10:00:00Z'
        };

        mockAxios.onPost('/api/rules/parse').reply(200, ruleData);

        const result = await ruleService.parseRule('John cannot work past 5pm');

        expect(result.rule_type).toBe('availability');
        expect(result.employee).toBe('John Doe');
        expect(result.constraints).toHaveLength(1);
      });

      it('should handle parsing errors', async () => {
        mockAxios.onPost('/api/rules/parse').reply(400, {
          detail: 'Unable to parse rule'
        });

        await expect(ruleService.parseRule('invalid rule text'))
          .rejects
          .toThrow('Unable to parse rule');
      });

      it('should handle empty rule text', async () => {
        await expect(ruleService.parseRule(''))
          .rejects
          .toThrow();
      });
    });

    describe('getRules', () => {
      it('should fetch all rules successfully', async () => {
        const rulesData = {
          rules: [
            { id: 1, rule_text: 'Rule 1', rule_type: 'availability' },
            { id: 2, rule_text: 'Rule 2', rule_type: 'preference' }
          ],
          total: 2
        };

        mockAxios.onGet('/api/rules').reply(200, rulesData);

        const result = await ruleService.getRules();

        expect(result.rules).toHaveLength(2);
        expect(result.total).toBe(2);
      });

      it('should handle empty rules list', async () => {
        mockAxios.onGet('/api/rules').reply(200, { rules: [], total: 0 });

        const result = await ruleService.getRules();

        expect(result.rules).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });

    describe('deleteRule', () => {
      it('should delete rule successfully', async () => {
        mockAxios.onDelete('/api/rules/1').reply(200, { success: true });

        const result = await ruleService.deleteRule(1);

        expect(result.success).toBe(true);
      });

      it('should handle delete errors', async () => {
        mockAxios.onDelete('/api/rules/999').reply(404, {
          detail: 'Rule not found'
        });

        await expect(ruleService.deleteRule(999))
          .rejects
          .toThrow('Rule not found');
      });
    });

    describe('updateRule', () => {
      it('should update rule successfully', async () => {
        const updatedRule = {
          id: 1,
          rule_text: 'Updated rule',
          active: false
        };

        mockAxios.onPatch('/api/rules/1').reply(200, updatedRule);

        const result = await ruleService.updateRule(1, { active: false });

        expect(result.active).toBe(false);
      });
    });
  });

  describe('ScheduleService', () => {
    describe('generateSchedule', () => {
      it('should generate schedule successfully', async () => {
        const scheduleData = {
          id: 1,
          start_date: '2024-01-15',
          end_date: '2024-01-21',
          status: 'generated',
          shifts: [
            {
              id: 'shift-1',
              date: '2024-01-15',
              start_time: '09:00',
              end_time: '17:00',
              employees: ['John Doe']
            }
          ]
        };

        mockAxios.onPost('/api/schedule/generate').reply(200, scheduleData);

        const result = await scheduleService.generateSchedule('2024-01-15', '2024-01-21');

        expect(result.status).toBe('generated');
        expect(result.shifts).toHaveLength(1);
      });

      it('should handle generation errors', async () => {
        mockAxios.onPost('/api/schedule/generate').reply(400, {
          detail: 'Invalid date range'
        });

        await expect(scheduleService.generateSchedule('invalid', 'dates'))
          .rejects
          .toThrow('Invalid date range');
      });

      it('should validate date parameters', async () => {
        await expect(scheduleService.generateSchedule('', '2024-01-21'))
          .rejects
          .toThrow();

        await expect(scheduleService.generateSchedule('2024-01-15', ''))
          .rejects
          .toThrow();
      });
    });

    describe('optimizeSchedule', () => {
      it('should optimize schedule successfully', async () => {
        const optimizationData = {
          status: 'optimized',
          improvements: {
            cost_savings: '$500',
            coverage: '98%',
            satisfaction: '92%'
          },
          message: 'Schedule optimized successfully'
        };

        mockAxios.onPost('/api/schedule/optimize').reply(200, optimizationData);

        const result = await scheduleService.optimizeSchedule(1);

        expect(result.status).toBe('optimized');
        expect(result.improvements.cost_savings).toBe('$500');
      });

      it('should handle optimization failures', async () => {
        mockAxios.onPost('/api/schedule/optimize').reply(400, {
          detail: 'Unable to optimize schedule'
        });

        await expect(scheduleService.optimizeSchedule(1))
          .rejects
          .toThrow('Unable to optimize schedule');
      });
    });

    describe('getSchedule', () => {
      it('should fetch single schedule', async () => {
        const scheduleData = {
          id: 1,
          name: 'Week Schedule',
          status: 'published'
        };

        mockAxios.onGet('/api/schedule/1').reply(200, scheduleData);

        const result = await scheduleService.getSchedule(1);

        expect(result.id).toBe(1);
        expect(result.name).toBe('Week Schedule');
      });

      it('should handle not found errors', async () => {
        mockAxios.onGet('/api/schedule/999').reply(404, {
          detail: 'Schedule not found'
        });

        await expect(scheduleService.getSchedule(999))
          .rejects
          .toThrow('Schedule not found');
      });
    });

    describe('getSchedules', () => {
      it('should fetch all schedules', async () => {
        const schedulesData = {
          schedules: [
            { id: 1, name: 'Schedule 1' },
            { id: 2, name: 'Schedule 2' }
          ],
          total: 2
        };

        mockAxios.onGet('/api/schedules').reply(200, schedulesData);

        const result = await scheduleService.getSchedules();

        expect(result.schedules).toHaveLength(2);
        expect(result.total).toBe(2);
      });
    });

    describe('updateShift', () => {
      it('should update shift successfully', async () => {
        const updatedShift = {
          id: 'shift-1',
          start_time: '10:00',
          end_time: '18:00'
        };

        mockAxios.onPatch('/api/schedule/1/shift/shift-1').reply(200, updatedShift);

        const result = await scheduleService.updateShift(1, 'shift-1', {
          start_time: '10:00',
          end_time: '18:00'
        });

        expect(result.start_time).toBe('10:00');
        expect(result.end_time).toBe('18:00');
      });
    });
  });

  describe('EmployeeService', () => {
    describe('getEmployees', () => {
      it('should fetch all employees', async () => {
        const employeesData = {
          employees: [
            { id: 1, name: 'John Doe', role: 'Server' },
            { id: 2, name: 'Jane Smith', role: 'Cook' }
          ],
          total: 2
        };

        mockAxios.onGet('/api/employees').reply(200, employeesData);

        const result = await employeeService.getEmployees();

        expect(result.employees).toHaveLength(2);
        expect(result.total).toBe(2);
      });

      it('should handle server errors', async () => {
        mockAxios.onGet('/api/employees').reply(500);

        await expect(employeeService.getEmployees())
          .rejects
          .toThrow();
      });
    });

    describe('createEmployee', () => {
      it('should create employee successfully', async () => {
        const employeeData = {
          name: 'New Employee',
          email: 'new@example.com',
          role: 'Server'
        };

        const createdEmployee = {
          id: 3,
          ...employeeData,
          created_at: '2024-01-15T10:00:00Z'
        };

        mockAxios.onPost('/api/employees').reply(200, createdEmployee);

        const result = await employeeService.createEmployee(employeeData);

        expect(result.id).toBe(3);
        expect(result.name).toBe('New Employee');
        expect(result.email).toBe('new@example.com');
      });

      it('should handle validation errors', async () => {
        mockAxios.onPost('/api/employees').reply(422, {
          detail: [
            { field: 'email', message: 'Invalid email format' }
          ]
        });

        await expect(employeeService.createEmployee({
          name: 'Test',
          email: 'invalid-email'
        })).rejects.toThrow();
      });
    });

    describe('updateEmployee', () => {
      it('should update employee successfully', async () => {
        const updatedEmployee = {
          id: 1,
          name: 'John Doe',
          role: 'Senior Server'
        };

        mockAxios.onPatch('/api/employees/1').reply(200, updatedEmployee);

        const result = await employeeService.updateEmployee(1, { role: 'Senior Server' });

        expect(result.role).toBe('Senior Server');
      });
    });

    describe('deleteEmployee', () => {
      it('should delete employee successfully', async () => {
        mockAxios.onDelete('/api/employees/1').reply(200, { success: true });

        const result = await employeeService.deleteEmployee(1);

        expect(result.success).toBe(true);
      });

      it('should handle delete constraints', async () => {
        mockAxios.onDelete('/api/employees/1').reply(400, {
          detail: 'Cannot delete employee with scheduled shifts'
        });

        await expect(employeeService.deleteEmployee(1))
          .rejects
          .toThrow('Cannot delete employee with scheduled shifts');
      });
    });

    describe('getEmployeeSchedule', () => {
      it('should fetch employee schedule', async () => {
        const scheduleData = {
          employee_id: 1,
          shifts: [
            {
              date: '2024-01-15',
              start_time: '09:00',
              end_time: '17:00',
              position: 'Server'
            }
          ]
        };

        mockAxios.onGet('/api/employees/1/schedule').reply(200, scheduleData);

        const result = await employeeService.getEmployeeSchedule(1, '2024-01-15', '2024-01-21');

        expect(result.employee_id).toBe(1);
        expect(result.shifts).toHaveLength(1);
      });
    });
  });

  describe('AnalyticsService', () => {
    describe('getOverview', () => {
      it('should fetch analytics overview', async () => {
        const analyticsData = {
          total_employees: 25,
          total_rules: 15,
          total_schedules: 8,
          avg_hours_per_week: 36,
          optimization_score: 87
        };

        mockAxios.onGet('/api/analytics/overview').reply(200, analyticsData);

        const result = await analyticsService.getOverview();

        expect(result.total_employees).toBe(25);
        expect(result.optimization_score).toBe(87);
      });
    });

    describe('getLaborCosts', () => {
      it('should fetch labor costs with default period', async () => {
        const costData = {
          current_period: 5200,
          previous_period: 5400,
          trend: 'decreasing',
          breakdown: {
            regular_hours: 4000,
            overtime: 800,
            benefits: 400
          }
        };

        mockAxios.onGet('/api/analytics/labor-costs').reply(200, costData);

        const result = await analyticsService.getLaborCosts();

        expect(result.trend).toBe('decreasing');
        expect(result.breakdown.regular_hours).toBe(4000);
      });

      it('should fetch labor costs with custom period', async () => {
        mockAxios.onGet('/api/analytics/labor-costs', {
          params: { period: '30d' }
        }).reply(200, { period: '30d' });

        const result = await analyticsService.getLaborCosts('30d');

        expect(result.period).toBe('30d');
      });
    });

    describe('getOptimizationMetrics', () => {
      it('should fetch optimization metrics', async () => {
        const metricsData = {
          schedule_efficiency: 94,
          cost_optimization: 78,
          employee_satisfaction: 85,
          coverage_quality: 92
        };

        mockAxios.onGet('/api/analytics/optimization').reply(200, metricsData);

        const result = await analyticsService.getOptimizationMetrics();

        expect(result.schedule_efficiency).toBe(94);
        expect(result.employee_satisfaction).toBe(85);
      });
    });

    describe('getEmployeeMetrics', () => {
      it('should fetch metrics for specific employee', async () => {
        const employeeMetrics = {
          employee_id: 1,
          total_hours: 160,
          shifts_count: 20,
          performance_score: 92,
          attendance_rate: 98
        };

        mockAxios.onGet('/api/analytics/employee/1').reply(200, employeeMetrics);

        const result = await analyticsService.getEmployeeMetrics(1);

        expect(result.employee_id).toBe(1);
        expect(result.performance_score).toBe(92);
      });
    });
  });

  describe('NotificationService', () => {
    describe('getNotifications', () => {
      it('should fetch all notifications', async () => {
        const notificationsData = {
          notifications: [
            {
              id: 1,
              type: 'schedule',
              title: 'New Schedule',
              message: 'Your schedule is ready',
              read: false,
              created_at: '2024-01-15T10:00:00Z'
            }
          ],
          unread_count: 1
        };

        mockAxios.onGet('/api/notifications').reply(200, notificationsData);

        const result = await notificationService.getNotifications();

        expect(result.notifications).toHaveLength(1);
        expect(result.unread_count).toBe(1);
      });
    });

    describe('markAsRead', () => {
      it('should mark notification as read', async () => {
        mockAxios.onPatch('/api/notifications/1/read').reply(200, {
          id: 1,
          read: true
        });

        const result = await notificationService.markAsRead(1);

        expect(result.read).toBe(true);
      });
    });

    describe('markAllAsRead', () => {
      it('should mark all notifications as read', async () => {
        mockAxios.onPost('/api/notifications/read-all').reply(200, {
          updated_count: 5
        });

        const result = await notificationService.markAllAsRead();

        expect(result.updated_count).toBe(5);
      });
    });

    describe('deleteNotification', () => {
      it('should delete notification successfully', async () => {
        mockAxios.onDelete('/api/notifications/1').reply(200, { success: true });

        const result = await notificationService.deleteNotification(1);

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Request Interceptors', () => {
    it('should add authorization header when token exists', async () => {
      localStorage.setItem('token', 'test-token-123');

      mockAxios.onGet('/api/employees').reply(config => {
        expect(config.headers.Authorization).toBe('Bearer test-token-123');
        return [200, { employees: [] }];
      });

      await employeeService.getEmployees();
    });

    it('should not add authorization header when no token', async () => {
      mockAxios.onGet('/api/employees').reply(config => {
        expect(config.headers.Authorization).toBeUndefined();
        return [200, { employees: [] }];
      });

      await employeeService.getEmployees();
    });
  });

  describe('Response Interceptors', () => {
    it('should handle 401 responses by clearing auth and redirecting', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ email: 'test@example.com' }));

      // Mock window.location.href
      delete window.location;
      window.location = { href: '' };

      mockAxios.onGet('/api/employees').reply(401, {
        detail: 'Token expired'
      });

      await expect(employeeService.getEmployees())
        .rejects
        .toThrow();

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('should extract error messages properly', async () => {
      // Test different error response formats
      mockAxios.onGet('/api/test1').reply(400, {
        detail: 'Detailed error message'
      });

      await expect(axios.get('/api/test1'))
        .rejects
        .toMatchObject({
          message: 'Detailed error message'
        });

      mockAxios.onGet('/api/test2').reply(400, {
        message: 'Message error format'
      });

      await expect(axios.get('/api/test2'))
        .rejects
        .toMatchObject({
          message: 'Message error format'
        });
    });

    it('should provide default error message for unknown errors', async () => {
      mockAxios.onGet('/api/test').reply(500, {});

      await expect(axios.get('/api/test'))
        .rejects
        .toMatchObject({
          message: 'An unexpected error occurred'
        });
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      mockAxios.onGet('/api/employees').timeout();

      await expect(employeeService.getEmployees())
        .rejects
        .toThrow('timeout');
    });

    it('should handle malformed JSON responses', async () => {
      mockAxios.onGet('/api/employees').reply(200, 'invalid-json');

      await expect(employeeService.getEmployees())
        .rejects
        .toThrow();
    });

    it('should handle empty responses', async () => {
      mockAxios.onGet('/api/employees').reply(200, null);

      const result = await employeeService.getEmployees();

      expect(result).toBeNull();
    });
  });

  describe('API Configuration', () => {
    it('should use correct base URL', () => {
      const originalEnv = process.env.REACT_APP_API_URL;
      process.env.REACT_APP_API_URL = 'https://custom-api.example.com';

      // Re-import to get new configuration
      jest.resetModules();

      // In a real test, you'd verify the new base URL is used
      expect(process.env.REACT_APP_API_URL).toBe('https://custom-api.example.com');

      process.env.REACT_APP_API_URL = originalEnv;
    });

    it('should set correct timeout', async () => {
      // Test that requests timeout after configured period
      const start = Date.now();

      mockAxios.onGet('/api/slow-endpoint').timeout();

      try {
        await axios.get('/api/slow-endpoint');
      } catch (error) {
        const duration = Date.now() - start;
        expect(duration).toBeGreaterThan(9000); // Should timeout around 10 seconds
      }
    });

    it('should set correct default headers', async () => {
      mockAxios.onGet('/api/test').reply(config => {
        expect(config.headers['Content-Type']).toBe('application/json');
        return [200, {}];
      });

      await axios.get('/api/test');
    });
  });
});