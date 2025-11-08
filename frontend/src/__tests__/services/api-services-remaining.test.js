/**
 * API Services Tests (Remaining Services Only)
 * Tests for services that still exist: authService, scheduleService, analyticsService, notificationService
 * NOTE: employeeService, ruleService, shiftService were deleted during KISS refactoring
 * Those API calls now use axios directly - see component tests for axios mock examples
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  authService,
  scheduleService,
  analyticsService,
  notificationService
} from '../../services/api';
import api from '../../services/api';

// Create mock adapter
const mockAxios = new MockAdapter(axios);

describe('API Services (Remaining After KISS Refactoring)', () => {
  beforeEach(() => {
    mockAxios.reset();
    localStorage.clear();
  });

  afterEach(() => {
    mockAxios.reset();
    localStorage.clear();
  });

  describe('AuthService', () => {
    it('should login successfully', async () => {
      const loginData = {
        access_token: 'test-token-123',
        user: { email: 'test@example.com', role: 'manager' }
      };

      mockAxios.onPost('/api/auth/login').reply(200, loginData);

      const result = await authService.login('test@example.com', 'password123');

      expect(result.token).toBe('test-token-123');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should logout successfully', () => {
      localStorage.setItem('token', 'test-token');
      delete window.location;
      window.location = { href: '' };

      authService.logout();

      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('ScheduleService', () => {
    it('should get schedules', async () => {
      const mockSchedules = { schedules: [] };
      mockAxios.onGet('/api/schedules').reply(200, mockSchedules);

      const result = await scheduleService.getSchedules();

      expect(result.schedules).toBeDefined();
    });
  });

  describe('AnalyticsService', () => {
    it('should get analytics overview', async () => {
      const mockAnalytics = { total_employees: 25 };
      mockAxios.onGet('/api/analytics/overview').reply(200, mockAnalytics);

      const result = await analyticsService.getOverview();

      expect(result.total_employees).toBe(25);
    });
  });

  describe('NotificationService', () => {
    it('should get notifications', async () => {
      const mockNotifications = { notifications: [] };
      mockAxios.onGet('/api/notifications').reply(200, mockNotifications);

      const result = await notificationService.getNotifications();

      expect(result.notifications).toBeDefined();
    });
  });

  describe('Direct Axios API Calls (for deleted services)', () => {
    describe('Employee API', () => {
      it('should fetch employees via axios', async () => {
        const employeesData = { employees: [] };
        mockAxios.onGet('/api/employees').reply(200, employeesData);

        const result = await api.get('/api/employees');

        expect(result.data).toEqual(employeesData);
      });

      it('should create employee via axios', async () => {
        const employeeData = { name: 'Test' };
        mockAxios.onPost('/api/employees').reply(200, employeeData);

        const result = await api.post('/api/employees', employeeData);

        expect(result.data).toEqual(employeeData);
      });
    });

    describe('Rule API', () => {
      it('should parse rule via axios', async () => {
        const ruleData = { id: 1, rule_type: 'availability' };
        mockAxios.onPost('/api/rules/parse').reply(200, ruleData);

        const result = await api.post('/api/rules/parse', { rule_text: 'test' });

        expect(result.data.rule_type).toBe('availability');
      });
    });
  });
});
