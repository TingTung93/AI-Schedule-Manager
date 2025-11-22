/**
 * Enhanced Tests for Department Service
 *
 * Covers all departmentService functions including:
 * - CRUD operations
 * - Bulk assignment operations
 * - Analytics functions
 * - History tracking
 * - Error handling
 */

import MockAdapter from 'axios-mock-adapter';
import api from '../api';
import {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  bulkAssignDepartment,
  transferDepartment,
  getUnassignedEmployees,
  getDepartmentAnalyticsOverview,
  getDepartmentDistribution,
  getDepartmentAnalytics,
  getEmployeeDepartmentHistory
} from '../departmentService';

describe('Department Service - Enhanced Tests', () => {
  let mock;

  beforeAll(() => {
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    mock.reset();
  });

  afterAll(() => {
    mock.restore();
  });

  describe('CRUD Operations', () => {
    describe('getDepartments', () => {
      it('should fetch departments with pagination', async () => {
        const mockResponse = {
          items: [
            { id: 1, name: 'Sales', employeeCount: 10 },
            { id: 2, name: 'Engineering', employeeCount: 25 }
          ],
          total: 2,
          page: 1,
          size: 10,
          pages: 1
        };

        mock.onGet('/api/departments').reply(200, mockResponse);

        const result = await getDepartments({ page: 1, size: 10 });

        expect(result).toEqual(mockResponse);
        expect(result.items).toHaveLength(2);
        expect(result.total).toBe(2);
      });

      it('should fetch departments with filters', async () => {
        const params = {
          active: true,
          search: 'Sales',
          sortBy: 'name',
          sortOrder: 'asc'
        };

        mock.onGet('/api/departments', { params }).reply(200, {
          items: [{ id: 1, name: 'Sales' }],
          total: 1
        });

        const result = await getDepartments(params);

        expect(result.items).toHaveLength(1);
        expect(result.items[0].name).toBe('Sales');
      });

      it('should handle API errors', async () => {
        mock.onGet('/api/departments').reply(500, {
          message: 'Server error'
        });

        await expect(getDepartments()).rejects.toThrow();
      });

      it('should handle network errors', async () => {
        mock.onGet('/api/departments').networkError();

        await expect(getDepartments()).rejects.toThrow();
      });
    });

    describe('getDepartment', () => {
      it('should fetch single department with hierarchy', async () => {
        const mockDepartment = {
          id: 1,
          name: 'Engineering',
          description: 'Tech department',
          parentDepartment: { id: 5, name: 'Operations' },
          childDepartments: [
            { id: 10, name: 'Frontend' },
            { id: 11, name: 'Backend' }
          ]
        };

        mock.onGet('/api/departments/1').reply(200, mockDepartment);

        const result = await getDepartment(1);

        expect(result).toEqual(mockDepartment);
        expect(result.parentDepartment).toBeDefined();
        expect(result.childDepartments).toHaveLength(2);
      });

      it('should handle department not found', async () => {
        mock.onGet('/api/departments/999').reply(404, {
          message: 'Department not found'
        });

        await expect(getDepartment(999)).rejects.toThrow();
      });
    });

    describe('createDepartment', () => {
      it('should create new department', async () => {
        const newDept = {
          name: 'Marketing',
          description: 'Marketing team',
          active: true
        };

        const createdDept = {
          id: 5,
          ...newDept,
          createdAt: '2025-11-21T10:00:00Z'
        };

        mock.onPost('/api/departments', newDept).reply(201, createdDept);

        const result = await createDepartment(newDept);

        expect(result).toEqual(createdDept);
        expect(result.id).toBe(5);
      });

      it('should handle duplicate name error', async () => {
        const duplicateDept = {
          name: 'Sales',
          description: 'Sales team'
        };

        mock.onPost('/api/departments').reply(409, {
          message: 'Department name already exists'
        });

        await expect(createDepartment(duplicateDept)).rejects.toThrow();
      });

      it('should handle validation errors', async () => {
        const invalidDept = {
          name: '', // Empty name
          description: 'Test'
        };

        mock.onPost('/api/departments').reply(400, {
          message: 'Validation failed',
          errors: { name: 'Name is required' }
        });

        await expect(createDepartment(invalidDept)).rejects.toThrow();
      });
    });

    describe('updateDepartment', () => {
      it('should update department', async () => {
        const updates = {
          description: 'Updated description',
          active: false
        };

        const updatedDept = {
          id: 1,
          name: 'Sales',
          ...updates,
          updatedAt: '2025-11-21T11:00:00Z'
        };

        mock.onPatch('/api/departments/1', updates).reply(200, updatedDept);

        const result = await updateDepartment(1, updates);

        expect(result).toEqual(updatedDept);
        expect(result.description).toBe('Updated description');
      });

      it('should handle update of non-existent department', async () => {
        mock.onPatch('/api/departments/999').reply(404, {
          message: 'Department not found'
        });

        await expect(updateDepartment(999, {})).rejects.toThrow();
      });
    });

    describe('deleteDepartment', () => {
      it('should delete department', async () => {
        mock.onDelete('/api/departments/1').reply(200, {
          success: true,
          message: 'Department deleted'
        });

        const result = await deleteDepartment(1);

        expect(result.success).toBe(true);
      });

      it('should force delete department with employees', async () => {
        mock.onDelete('/api/departments/1', { params: { force: true } })
          .reply(200, {
            success: true,
            message: 'Department force deleted'
          });

        const result = await deleteDepartment(1, true);

        expect(result.success).toBe(true);
      });

      it('should handle delete error when department has employees', async () => {
        mock.onDelete('/api/departments/1').reply(409, {
          message: 'Cannot delete department with employees'
        });

        await expect(deleteDepartment(1)).rejects.toThrow();
      });
    });
  });

  describe('Bulk Assignment Operations', () => {
    describe('bulkAssignDepartment', () => {
      it('should successfully assign multiple employees', async () => {
        const employeeIds = [1, 2, 3, 4, 5];
        const departmentId = 10;

        const mockResponse = {
          totalAttempted: 5,
          successCount: 5,
          failureCount: 0,
          failures: []
        };

        mock.onPost('/api/employees/bulk-assign-department', {
          employeeIds,
          departmentId
        }).reply(200, mockResponse);

        const result = await bulkAssignDepartment(employeeIds, departmentId);

        expect(result.successCount).toBe(5);
        expect(result.failureCount).toBe(0);
      });

      it('should handle partial assignment success', async () => {
        const employeeIds = [1, 2, 3];
        const departmentId = 10;

        const mockResponse = {
          totalAttempted: 3,
          successCount: 2,
          failureCount: 1,
          failures: [
            {
              employeeId: 3,
              error: 'Employee already assigned to department'
            }
          ]
        };

        mock.onPost('/api/employees/bulk-assign-department')
          .reply(200, mockResponse);

        const result = await bulkAssignDepartment(employeeIds, departmentId);

        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(1);
        expect(result.failures).toHaveLength(1);
      });

      it('should unassign employees when departmentId is null', async () => {
        const employeeIds = [1, 2];
        const departmentId = null;

        mock.onPost('/api/employees/bulk-assign-department', {
          employeeIds,
          departmentId
        }).reply(200, {
          totalAttempted: 2,
          successCount: 2,
          failureCount: 0
        });

        const result = await bulkAssignDepartment(employeeIds, departmentId);

        expect(result.successCount).toBe(2);
      });

      it('should handle bulk assignment errors', async () => {
        mock.onPost('/api/employees/bulk-assign-department')
          .reply(500, { message: 'Server error' });

        await expect(bulkAssignDepartment([1, 2], 10)).rejects.toThrow();
      });
    });

    describe('transferDepartment', () => {
      it('should transfer all employees between departments', async () => {
        const mockResponse = {
          totalAttempted: 10,
          successCount: 10,
          failureCount: 0,
          transferredEmployees: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        };

        mock.onPost('/api/employees/transfer-department', {
          fromDepartmentId: 5,
          toDepartmentId: 10,
          employeeIds: null
        }).reply(200, mockResponse);

        const result = await transferDepartment(5, 10);

        expect(result.successCount).toBe(10);
      });

      it('should transfer specific employees', async () => {
        const employeeIds = [1, 2, 3];

        const mockResponse = {
          totalAttempted: 3,
          successCount: 3,
          failureCount: 0
        };

        mock.onPost('/api/employees/transfer-department', {
          fromDepartmentId: 5,
          toDepartmentId: 10,
          employeeIds
        }).reply(200, mockResponse);

        const result = await transferDepartment(5, 10, employeeIds);

        expect(result.successCount).toBe(3);
      });

      it('should handle transfer errors', async () => {
        mock.onPost('/api/employees/transfer-department')
          .reply(400, { message: 'Invalid department' });

        await expect(transferDepartment(5, 10)).rejects.toThrow();
      });
    });

    describe('getUnassignedEmployees', () => {
      it('should fetch unassigned employees', async () => {
        const mockEmployees = [
          { id: 1, name: 'John Doe', email: 'john@example.com' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
        ];

        mock.onGet('/api/employees/unassigned')
          .reply(200, mockEmployees);

        const result = await getUnassignedEmployees();

        expect(result).toHaveLength(2);
      });

      it('should fetch with pagination', async () => {
        const params = { skip: 10, limit: 20 };

        mock.onGet('/api/employees/unassigned', { params })
          .reply(200, []);

        const result = await getUnassignedEmployees(params);

        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Analytics Operations', () => {
    describe('getDepartmentAnalyticsOverview', () => {
      it('should fetch organization analytics', async () => {
        const mockAnalytics = {
          totalDepartments: 15,
          activeDepartments: 12,
          totalEmployees: 150,
          averageEmployeesPerDepartment: 10,
          maxHierarchyDepth: 3,
          unassignedEmployees: 5
        };

        mock.onGet('/api/departments/analytics/overview')
          .reply(200, mockAnalytics);

        const result = await getDepartmentAnalyticsOverview();

        expect(result.totalDepartments).toBe(15);
        expect(result.unassignedEmployees).toBe(5);
      });

      it('should handle analytics fetch errors', async () => {
        mock.onGet('/api/departments/analytics/overview')
          .reply(500);

        await expect(getDepartmentAnalyticsOverview()).rejects.toThrow();
      });
    });

    describe('getDepartmentDistribution', () => {
      it('should fetch employee distribution', async () => {
        const mockDistribution = [
          { departmentId: 1, departmentName: 'Sales', employeeCount: 20, percentage: 40 },
          { departmentId: 2, departmentName: 'Engineering', employeeCount: 30, percentage: 60 }
        ];

        mock.onGet('/api/departments/analytics/distribution')
          .reply(200, mockDistribution);

        const result = await getDepartmentDistribution();

        expect(result).toHaveLength(2);
        expect(result[0].employeeCount).toBe(20);
      });
    });

    describe('getDepartmentAnalytics', () => {
      it('should fetch department-specific analytics', async () => {
        const mockAnalytics = {
          totalEmployees: 25,
          activeEmployees: 23,
          employeesByRole: {
            manager: 2,
            employee: 21,
            admin: 2
          },
          recentChanges: [
            { employeeId: 1, action: 'assigned', date: '2025-11-20' }
          ],
          hierarchyDepth: 2
        };

        mock.onGet('/api/departments/5/analytics')
          .reply(200, mockAnalytics);

        const result = await getDepartmentAnalytics(5);

        expect(result.totalEmployees).toBe(25);
        expect(result.employeesByRole.manager).toBe(2);
      });

      it('should handle analytics for non-existent department', async () => {
        mock.onGet('/api/departments/999/analytics')
          .reply(404);

        await expect(getDepartmentAnalytics(999)).rejects.toThrow();
      });
    });
  });

  describe('History Operations', () => {
    describe('getEmployeeDepartmentHistory', () => {
      it('should fetch employee assignment history', async () => {
        const mockHistory = {
          history: [
            {
              id: 1,
              employeeId: 123,
              fromDepartment: { id: 5, name: 'Sales' },
              toDepartment: { id: 10, name: 'Marketing' },
              changedAt: '2025-11-15T10:00:00Z',
              changedBy: { id: 1, name: 'Admin' },
              reason: 'Promotion'
            },
            {
              id: 2,
              employeeId: 123,
              fromDepartment: null,
              toDepartment: { id: 5, name: 'Sales' },
              changedAt: '2025-01-01T09:00:00Z',
              reason: 'Initial assignment'
            }
          ],
          total: 2,
          summary: {
            totalChanges: 2,
            departmentsWorkedIn: 2
          }
        };

        mock.onGet('/api/employees/123/department-history')
          .reply(200, mockHistory);

        const result = await getEmployeeDepartmentHistory(123);

        expect(result.history).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.summary.departmentsWorkedIn).toBe(2);
      });

      it('should fetch with pagination', async () => {
        const params = { limit: 10, offset: 5 };

        mock.onGet('/api/employees/123/department-history', { params })
          .reply(200, { history: [], total: 0 });

        const result = await getEmployeeDepartmentHistory(123, params);

        expect(result.history).toHaveLength(0);
      });

      it('should handle history fetch errors', async () => {
        mock.onGet('/api/employees/999/department-history')
          .reply(404);

        await expect(getEmployeeDepartmentHistory(999)).rejects.toThrow();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      mock.onGet('/api/departments').timeout();

      await expect(getDepartments()).rejects.toThrow();
    });

    it('should handle 401 unauthorized', async () => {
      mock.onGet('/api/departments').reply(401, {
        message: 'Unauthorized'
      });

      await expect(getDepartments()).rejects.toThrow();
    });

    it('should handle 403 forbidden', async () => {
      mock.onPost('/api/departments').reply(403, {
        message: 'Forbidden'
      });

      await expect(createDepartment({ name: 'Test' })).rejects.toThrow();
    });

    it('should handle malformed responses', async () => {
      mock.onGet('/api/departments').reply(200, 'Invalid JSON');

      // axios-mock-adapter will handle JSON parsing
      const result = await getDepartments();
      expect(result).toBe('Invalid JSON');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty department list', async () => {
      mock.onGet('/api/departments').reply(200, {
        items: [],
        total: 0,
        page: 1,
        size: 10
      });

      const result = await getDepartments();

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle empty employee IDs array in bulk assignment', async () => {
      mock.onPost('/api/employees/bulk-assign-department', {
        employeeIds: [],
        departmentId: 10
      }).reply(200, {
        totalAttempted: 0,
        successCount: 0,
        failureCount: 0
      });

      const result = await bulkAssignDepartment([], 10);

      expect(result.successCount).toBe(0);
    });

    it('should handle department with no parent', async () => {
      const mockDepartment = {
        id: 1,
        name: 'Root Department',
        parentDepartment: null,
        childDepartments: []
      };

      mock.onGet('/api/departments/1').reply(200, mockDepartment);

      const result = await getDepartment(1);

      expect(result.parentDepartment).toBeNull();
    });
  });
});
