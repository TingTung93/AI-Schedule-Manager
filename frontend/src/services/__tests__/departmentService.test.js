/**
 * Unit tests for departmentService
 *
 * Tests all 12 department service methods with mocked axios responses
 */

import departmentService from '../departmentService';
import api from '../api';

// Mock the api module
jest.mock('../api');

describe('departmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    describe('getDepartments', () => {
      it('should fetch departments with default parameters', async () => {
        const mockResponse = {
          data: {
            items: [
              { id: 1, name: 'Engineering', active: true },
              { id: 2, name: 'Sales', active: true },
            ],
            total: 2,
            page: 1,
            size: 10,
            pages: 1,
          },
        };

        api.get.mockResolvedValue(mockResponse);

        const result = await departmentService.getDepartments();

        expect(api.get).toHaveBeenCalledWith('/api/departments', { params: {} });
        expect(result).toEqual(mockResponse.data);
      });

      it('should fetch departments with filters', async () => {
        const mockResponse = {
          data: {
            items: [{ id: 1, name: 'Engineering', active: true }],
            total: 1,
            page: 1,
            size: 10,
            pages: 1,
          },
        };

        api.get.mockResolvedValue(mockResponse);

        const params = { active: true, search: 'Eng', page: 1, size: 20 };
        await departmentService.getDepartments(params);

        expect(api.get).toHaveBeenCalledWith('/api/departments', { params });
      });

      it('should handle errors', async () => {
        api.get.mockRejectedValue(new Error('Network error'));

        await expect(departmentService.getDepartments()).rejects.toThrow('Network error');
      });
    });

    describe('getDepartment', () => {
      it('should fetch single department by ID', async () => {
        const mockResponse = {
          data: {
            id: 1,
            name: 'Engineering',
            active: true,
            parentDepartment: null,
            childDepartments: [],
          },
        };

        api.get.mockResolvedValue(mockResponse);

        const result = await departmentService.getDepartment(1);

        expect(api.get).toHaveBeenCalledWith('/api/departments/1');
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('createDepartment', () => {
      it('should create new department', async () => {
        const departmentData = {
          name: 'Engineering',
          description: 'Software Development',
          active: true,
        };

        const mockResponse = {
          data: { id: 1, ...departmentData },
        };

        api.post.mockResolvedValue(mockResponse);

        const result = await departmentService.createDepartment(departmentData);

        expect(api.post).toHaveBeenCalledWith('/api/departments', departmentData);
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('updateDepartment', () => {
      it('should update department', async () => {
        const updates = { description: 'Updated description' };
        const mockResponse = {
          data: { id: 1, name: 'Engineering', ...updates },
        };

        api.patch.mockResolvedValue(mockResponse);

        const result = await departmentService.updateDepartment(1, updates);

        expect(api.patch).toHaveBeenCalledWith('/api/departments/1', updates);
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('deleteDepartment', () => {
      it('should delete department without force', async () => {
        const mockResponse = { data: { message: 'Department deleted' } };
        api.delete.mockResolvedValue(mockResponse);

        await departmentService.deleteDepartment(1);

        expect(api.delete).toHaveBeenCalledWith('/api/departments/1', {
          params: { force: false },
        });
      });

      it('should force delete department', async () => {
        const mockResponse = { data: { message: 'Department force deleted' } };
        api.delete.mockResolvedValue(mockResponse);

        await departmentService.deleteDepartment(1, true);

        expect(api.delete).toHaveBeenCalledWith('/api/departments/1', {
          params: { force: true },
        });
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('bulkAssignDepartment', () => {
      it('should bulk assign employees to department', async () => {
        const mockResponse = {
          data: {
            totalAttempted: 3,
            successCount: 3,
            failureCount: 0,
            failures: [],
          },
        };

        api.post.mockResolvedValue(mockResponse);

        const result = await departmentService.bulkAssignDepartment([1, 2, 3], 5);

        expect(api.post).toHaveBeenCalledWith('/api/employees/bulk-assign-department', {
          employeeIds: [1, 2, 3],
          departmentId: 5,
        });
        expect(result.successCount).toBe(3);
      });

      it('should handle partial failures', async () => {
        const mockResponse = {
          data: {
            totalAttempted: 3,
            successCount: 2,
            failureCount: 1,
            failures: [{ employeeId: 3, error: 'Employee not found' }],
          },
        };

        api.post.mockResolvedValue(mockResponse);

        const result = await departmentService.bulkAssignDepartment([1, 2, 3], 5);

        expect(result.failureCount).toBe(1);
        expect(result.failures).toHaveLength(1);
      });

      it('should support unassigning (null department)', async () => {
        const mockResponse = {
          data: { totalAttempted: 2, successCount: 2, failureCount: 0 },
        };

        api.post.mockResolvedValue(mockResponse);

        await departmentService.bulkAssignDepartment([1, 2], null);

        expect(api.post).toHaveBeenCalledWith('/api/employees/bulk-assign-department', {
          employeeIds: [1, 2],
          departmentId: null,
        });
      });
    });

    describe('transferDepartment', () => {
      it('should transfer all employees between departments', async () => {
        const mockResponse = {
          data: { totalAttempted: 10, successCount: 10, failureCount: 0 },
        };

        api.post.mockResolvedValue(mockResponse);

        await departmentService.transferDepartment(5, 10);

        expect(api.post).toHaveBeenCalledWith('/api/employees/transfer-department', {
          fromDepartmentId: 5,
          toDepartmentId: 10,
          employeeIds: null,
        });
      });

      it('should transfer specific employees', async () => {
        const mockResponse = {
          data: { totalAttempted: 3, successCount: 3, failureCount: 0 },
        };

        api.post.mockResolvedValue(mockResponse);

        await departmentService.transferDepartment(5, 10, [1, 2, 3]);

        expect(api.post).toHaveBeenCalledWith('/api/employees/transfer-department', {
          fromDepartmentId: 5,
          toDepartmentId: 10,
          employeeIds: [1, 2, 3],
        });
      });
    });

    describe('getUnassignedEmployees', () => {
      it('should fetch unassigned employees', async () => {
        const mockResponse = {
          data: [
            { id: 1, firstName: 'John', lastName: 'Doe', departmentId: null },
            { id: 2, firstName: 'Jane', lastName: 'Smith', departmentId: null },
          ],
        };

        api.get.mockResolvedValue(mockResponse);

        const result = await departmentService.getUnassignedEmployees();

        expect(api.get).toHaveBeenCalledWith('/api/employees/unassigned', { params: {} });
        expect(result).toHaveLength(2);
      });

      it('should fetch unassigned employees with pagination', async () => {
        const mockResponse = { data: [] };
        api.get.mockResolvedValue(mockResponse);

        await departmentService.getUnassignedEmployees({ skip: 10, limit: 50 });

        expect(api.get).toHaveBeenCalledWith('/api/employees/unassigned', {
          params: { skip: 10, limit: 50 },
        });
      });
    });
  });

  describe('Analytics Operations', () => {
    describe('getDepartmentAnalyticsOverview', () => {
      it('should fetch organization-wide analytics', async () => {
        const mockResponse = {
          data: {
            totalDepartments: 10,
            activeDepartments: 8,
            totalEmployees: 150,
            averageEmployeesPerDepartment: 15,
            maxHierarchyDepth: 3,
            unassignedEmployees: 5,
          },
        };

        api.get.mockResolvedValue(mockResponse);

        const result = await departmentService.getDepartmentAnalyticsOverview();

        expect(api.get).toHaveBeenCalledWith('/api/departments/analytics/overview');
        expect(result.totalDepartments).toBe(10);
      });
    });

    describe('getDepartmentDistribution', () => {
      it('should fetch employee distribution', async () => {
        const mockResponse = {
          data: [
            { departmentId: 1, departmentName: 'Engineering', employeeCount: 50, percentage: 33.3 },
            { departmentId: 2, departmentName: 'Sales', employeeCount: 30, percentage: 20.0 },
          ],
        };

        api.get.mockResolvedValue(mockResponse);

        const result = await departmentService.getDepartmentDistribution();

        expect(api.get).toHaveBeenCalledWith('/api/departments/analytics/distribution');
        expect(result).toHaveLength(2);
      });
    });

    describe('getDepartmentAnalytics', () => {
      it('should fetch department-specific analytics', async () => {
        const mockResponse = {
          data: {
            totalEmployees: 50,
            activeEmployees: 45,
            employeesByRole: {
              engineer: 30,
              manager: 10,
              intern: 10,
            },
            recentChanges: [],
            hierarchyDepth: 2,
          },
        };

        api.get.mockResolvedValue(mockResponse);

        const result = await departmentService.getDepartmentAnalytics(1);

        expect(api.get).toHaveBeenCalledWith('/api/departments/1/analytics');
        expect(result.totalEmployees).toBe(50);
      });
    });
  });

  describe('History Operations', () => {
    describe('getEmployeeDepartmentHistory', () => {
      it('should fetch employee department history', async () => {
        const mockResponse = {
          data: {
            history: [
              {
                id: 1,
                employeeId: 123,
                fromDepartmentId: 1,
                toDepartmentId: 2,
                changedAt: '2024-01-15T10:00:00Z',
                changedByUserId: 5,
              },
            ],
            total: 1,
            summary: {
              totalAssignments: 1,
              uniqueDepartments: 2,
            },
          },
        };

        api.get.mockResolvedValue(mockResponse);

        const result = await departmentService.getEmployeeDepartmentHistory(123);

        expect(api.get).toHaveBeenCalledWith('/api/employees/123/department-history', {
          params: {},
        });
        expect(result.history).toHaveLength(1);
      });

      it('should fetch history with pagination', async () => {
        const mockResponse = {
          data: { history: [], total: 0, summary: {} },
        };

        api.get.mockResolvedValue(mockResponse);

        await departmentService.getEmployeeDepartmentHistory(123, { limit: 20, offset: 10 });

        expect(api.get).toHaveBeenCalledWith('/api/employees/123/department-history', {
          params: { limit: 20, offset: 10 },
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 409 conflict errors', async () => {
      const conflictError = {
        response: {
          status: 409,
          data: { detail: 'Department name already exists' },
        },
      };

      api.post.mockRejectedValue(conflictError);

      await expect(
        departmentService.createDepartment({ name: 'Engineering' })
      ).rejects.toMatchObject(conflictError);
    });

    it('should handle 400 validation errors', async () => {
      const validationError = {
        response: {
          status: 400,
          data: { detail: 'Department is inactive' },
        },
      };

      api.post.mockRejectedValue(validationError);

      await expect(
        departmentService.bulkAssignDepartment([1, 2], 999)
      ).rejects.toMatchObject(validationError);
    });

    it('should handle 404 not found errors', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { detail: 'Department not found' },
        },
      };

      api.get.mockRejectedValue(notFoundError);

      await expect(departmentService.getDepartment(999)).rejects.toMatchObject(notFoundError);
    });
  });
});
