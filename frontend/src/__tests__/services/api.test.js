import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import API, { 
  authService, 
  ruleService, 
  scheduleService, 
  employeeService,
  analyticsService,
  notificationService 
} from '../../services/api';

// Create mock adapter
const mock = new MockAdapter(API);

describe('API Service Tests', () => {
  afterEach(() => {
    mock.reset();
    localStorage.clear();
  });

  describe('Authentication Service', () => {
    test('should login successfully and store token', async () => {
      const mockResponse = {
        access_token: 'test-token-123',
        user: { email: 'test@example.com', role: 'manager' }
      };

      mock.onPost('/api/auth/login').reply(200, mockResponse);

      const result = await authService.login('test@example.com', 'password123');
      
      expect(result.token).toBe('test-token-123');
      expect(result.user.email).toBe('test@example.com');
      expect(localStorage.getItem('token')).toBe('test-token-123');
      expect(JSON.parse(localStorage.getItem('user'))).toEqual(mockResponse.user);
    });

    test('should handle login failure', async () => {
      mock.onPost('/api/auth/login').reply(401, { detail: 'Invalid credentials' });

      await expect(authService.login('wrong@example.com', 'wrongpass'))
        .rejects.toMatchObject({ message: 'Invalid credentials' });
    });

    test('should logout and clear storage', () => {
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

    test('should check authentication status', () => {
      expect(authService.isAuthenticated()).toBe(false);
      
      localStorage.setItem('token', 'test-token');
      expect(authService.isAuthenticated()).toBe(true);
    });

    test('should get current user', () => {
      expect(authService.getCurrentUser()).toBeNull();
      
      const user = { email: 'test@example.com', role: 'manager' };
      localStorage.setItem('user', JSON.stringify(user));
      
      expect(authService.getCurrentUser()).toEqual(user);
    });
  });

  describe('Rule Service', () => {
    test('should parse rule successfully', async () => {
      const mockResponse = {
        id: 1,
        rule_type: 'availability',
        employee: 'Sarah Johnson',
        constraints: [{ type: 'time', value: '17:00' }]
      };

      mock.onPost('/api/rules/parse').reply(200, mockResponse);

      const result = await ruleService.parseRule("Sarah can't work past 5pm");
      
      expect(result.rule_type).toBe('availability');
      expect(result.employee).toBe('Sarah Johnson');
      expect(result.constraints).toHaveLength(1);
    });

    test('should get all rules', async () => {
      const mockResponse = {
        rules: [
          { id: 1, rule_type: 'availability', text: 'Test rule 1' },
          { id: 2, rule_type: 'preference', text: 'Test rule 2' }
        ],
        total: 2
      };

      mock.onGet('/api/rules').reply(200, mockResponse);

      const result = await ruleService.getRules();
      
      expect(result.rules).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    test('should delete rule', async () => {
      mock.onDelete('/api/rules/1').reply(200, { success: true });

      const result = await ruleService.deleteRule(1);
      expect(result.success).toBe(true);
    });

    test('should update rule', async () => {
      const updates = { active: false };
      mock.onPatch('/api/rules/1').reply(200, { id: 1, ...updates });

      const result = await ruleService.updateRule(1, updates);
      expect(result.active).toBe(false);
    });
  });

  describe('Schedule Service', () => {
    test('should generate schedule', async () => {
      const mockResponse = {
        id: 1,
        start_date: '2024-01-01',
        end_date: '2024-01-07',
        shifts: [],
        status: 'generated'
      };

      mock.onPost('/api/schedule/generate').reply(200, mockResponse);

      const result = await scheduleService.generateSchedule('2024-01-01', '2024-01-07');
      
      expect(result.id).toBe(1);
      expect(result.status).toBe('generated');
    });

    test('should optimize schedule', async () => {
      const mockResponse = {
        status: 'optimized',
        improvements: {
          cost_savings: '$500',
          coverage: '95%'
        }
      };

      mock.onPost('/api/schedule/optimize').reply(200, mockResponse);

      const result = await scheduleService.optimizeSchedule(1);
      
      expect(result.status).toBe('optimized');
      expect(result.improvements.cost_savings).toBe('$500');
    });

    test('should get schedule by ID', async () => {
      const mockResponse = { id: 1, status: 'active' };
      mock.onGet('/api/schedule/1').reply(200, mockResponse);

      const result = await scheduleService.getSchedule(1);
      expect(result.id).toBe(1);
    });

    test('should get all schedules', async () => {
      const mockResponse = [{ id: 1 }, { id: 2 }];
      mock.onGet('/api/schedules').reply(200, mockResponse);

      const result = await scheduleService.getSchedules();
      expect(result).toHaveLength(2);
    });

    test('should update shift', async () => {
      const updates = { employees: ['John', 'Sarah'] };
      mock.onPatch('/api/schedule/1/shift/2').reply(200, { id: 2, ...updates });

      const result = await scheduleService.updateShift(1, 2, updates);
      expect(result.employees).toEqual(['John', 'Sarah']);
    });
  });

  describe('Employee Service', () => {
    test('should get all employees', async () => {
      const mockResponse = {
        employees: [
          { id: 1, name: 'John Doe' },
          { id: 2, name: 'Jane Smith' }
        ],
        total: 2
      };

      mock.onGet('/api/employees').reply(200, mockResponse);

      const result = await employeeService.getEmployees();
      
      expect(result.employees).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    test('should create employee', async () => {
      const newEmployee = {
        name: 'New Employee',
        email: 'new@example.com',
        role: 'Server'
      };

      mock.onPost('/api/employees').reply(201, { id: 3, ...newEmployee });

      const result = await employeeService.createEmployee(newEmployee);
      
      expect(result.id).toBe(3);
      expect(result.name).toBe('New Employee');
    });

    test('should update employee', async () => {
      const updates = { role: 'Manager' };
      mock.onPatch('/api/employees/1').reply(200, { id: 1, ...updates });

      const result = await employeeService.updateEmployee(1, updates);
      expect(result.role).toBe('Manager');
    });

    test('should delete employee', async () => {
      mock.onDelete('/api/employees/1').reply(200, { success: true });

      const result = await employeeService.deleteEmployee(1);
      expect(result.success).toBe(true);
    });

    test('should get employee schedule', async () => {
      const mockResponse = {
        employee_id: 1,
        shifts: [{ day: 'Monday', time: '9-5' }]
      };

      mock.onGet('/api/employees/1/schedule').reply(200, mockResponse);

      const result = await employeeService.getEmployeeSchedule(1, '2024-01-01', '2024-01-07');
      
      expect(result.employee_id).toBe(1);
      expect(result.shifts).toHaveLength(1);
    });
  });

  describe('Analytics Service', () => {
    test('should get overview', async () => {
      const mockResponse = {
        total_employees: 10,
        total_rules: 5,
        optimization_score: 85
      };

      mock.onGet('/api/analytics/overview').reply(200, mockResponse);

      const result = await analyticsService.getOverview();
      
      expect(result.total_employees).toBe(10);
      expect(result.optimization_score).toBe(85);
    });

    test('should get labor costs', async () => {
      const mockResponse = {
        period: '7d',
        total_cost: 5000,
        daily_breakdown: []
      };

      mock.onGet('/api/analytics/labor-costs').reply(200, mockResponse);

      const result = await analyticsService.getLaborCosts('7d');
      
      expect(result.period).toBe('7d');
      expect(result.total_cost).toBe(5000);
    });

    test('should get optimization metrics', async () => {
      const mockResponse = {
        efficiency: 92,
        suggestions: ['Reduce overtime', 'Balance shifts']
      };

      mock.onGet('/api/analytics/optimization').reply(200, mockResponse);

      const result = await analyticsService.getOptimizationMetrics();
      
      expect(result.efficiency).toBe(92);
      expect(result.suggestions).toHaveLength(2);
    });

    test('should get employee metrics', async () => {
      const mockResponse = {
        employee_id: 1,
        hours_worked: 40,
        performance_score: 95
      };

      mock.onGet('/api/analytics/employee/1').reply(200, mockResponse);

      const result = await analyticsService.getEmployeeMetrics(1);
      
      expect(result.employee_id).toBe(1);
      expect(result.performance_score).toBe(95);
    });
  });

  describe('Notification Service', () => {
    test('should get notifications', async () => {
      const mockResponse = {
        notifications: [
          { id: 1, type: 'schedule', read: false },
          { id: 2, type: 'request', read: false }
        ],
        unread_count: 2
      };

      mock.onGet('/api/notifications').reply(200, mockResponse);

      const result = await notificationService.getNotifications();
      
      expect(result.notifications).toHaveLength(2);
      expect(result.unread_count).toBe(2);
    });

    test('should mark notification as read', async () => {
      mock.onPatch('/api/notifications/1/read').reply(200, { id: 1, read: true });

      const result = await notificationService.markAsRead(1);
      expect(result.read).toBe(true);
    });

    test('should mark all as read', async () => {
      mock.onPost('/api/notifications/read-all').reply(200, { success: true });

      const result = await notificationService.markAllAsRead();
      expect(result.success).toBe(true);
    });

    test('should delete notification', async () => {
      mock.onDelete('/api/notifications/1').reply(200, { success: true });

      const result = await notificationService.deleteNotification(1);
      expect(result.success).toBe(true);
    });
  });

  describe('Request Interceptors', () => {
    test('should add auth token to requests', async () => {
      localStorage.setItem('token', 'test-token-123');
      
      mock.onGet('/api/test').reply(config => {
        expect(config.headers.Authorization).toBe('Bearer test-token-123');
        return [200, { success: true }];
      });

      await API.get('/api/test');
    });

    test('should handle 401 and redirect to login', async () => {
      localStorage.setItem('token', 'expired-token');
      localStorage.setItem('user', JSON.stringify({ email: 'test@example.com' }));
      
      delete window.location;
      window.location = { href: '' };
      
      mock.onGet('/api/protected').reply(401, { detail: 'Unauthorized' });

      try {
        await API.get('/api/protected');
      } catch (error) {
        expect(error.message).toBe('Unauthorized');
      }

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(window.location.href).toBe('/login');
    });
  });
});