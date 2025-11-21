/**
 * Department Service Module
 *
 * Provides comprehensive department operations including CRUD,
 * analytics, bulk operations, and audit history.
 *
 * All data is automatically transformed between snake_case (backend)
 * and camelCase (frontend) via api.js interceptors.
 *
 * @module services/departmentService
 */

import api from './api';

/**
 * Department CRUD Operations
 */

/**
 * Get all departments with pagination and filtering
 *
 * @param {Object} params - Query parameters
 * @param {boolean} [params.active] - Filter by active status
 * @param {number} [params.parentId] - Filter by parent department ID
 * @param {string} [params.search] - Search by department name
 * @param {number} [params.page=1] - Page number
 * @param {number} [params.size=10] - Items per page
 * @param {string} [params.sortBy='name'] - Field to sort by
 * @param {string} [params.sortOrder='asc'] - Sort direction (asc|desc)
 * @returns {Promise<{items: Array, total: number, page: number, size: number, pages: number}>}
 *
 * @example
 * const { items, total } = await getDepartments({
 *   active: true,
 *   page: 1,
 *   size: 20
 * });
 */
export const getDepartments = async (params = {}) => {
  try {
    const response = await api.get('/api/departments', { params });
    return response.data;
  } catch (error) {
    console.error('Get departments failed:', error);
    throw error;
  }
};

/**
 * Get single department by ID with hierarchy information
 *
 * @param {number} departmentId - Department ID
 * @returns {Promise<Object>} Department with parent and children relationships
 *
 * @example
 * const department = await getDepartment(5);
 * console.log(department.parentDepartment);
 * console.log(department.childDepartments);
 */
export const getDepartment = async (departmentId) => {
  try {
    const response = await api.get(`/api/departments/${departmentId}`);
    return response.data;
  } catch (error) {
    console.error('Get department failed:', error);
    throw error;
  }
};

/**
 * Create new department
 *
 * @param {Object} departmentData - Department data
 * @param {string} departmentData.name - Department name (unique, required)
 * @param {string} [departmentData.description] - Department description
 * @param {number} [departmentData.parentDepartmentId] - Parent department ID
 * @param {boolean} [departmentData.active=true] - Active status
 * @returns {Promise<Object>} Created department
 *
 * @example
 * const dept = await createDepartment({
 *   name: 'Engineering',
 *   description: 'Software Development',
 *   active: true
 * });
 */
export const createDepartment = async (departmentData) => {
  try {
    const response = await api.post('/api/departments', departmentData);
    return response.data;
  } catch (error) {
    console.error('Create department failed:', error);
    throw error;
  }
};

/**
 * Update existing department
 *
 * @param {number} departmentId - Department ID
 * @param {Object} updates - Fields to update
 * @param {string} [updates.name] - New name
 * @param {string} [updates.description] - New description
 * @param {boolean} [updates.active] - New active status
 * @param {number} [updates.parentDepartmentId] - New parent department ID
 * @returns {Promise<Object>} Updated department
 *
 * @example
 * const updated = await updateDepartment(5, {
 *   description: 'Updated description',
 *   active: false
 * });
 */
export const updateDepartment = async (departmentId, updates) => {
  try {
    const response = await api.patch(`/api/departments/${departmentId}`, updates);
    return response.data;
  } catch (error) {
    console.error('Update department failed:', error);
    throw error;
  }
};

/**
 * Delete department
 *
 * @param {number} departmentId - Department ID
 * @param {boolean} [force=false] - Force delete even with employees
 * @returns {Promise<Object>} Deletion result
 *
 * @throws {Error} If department has employees and force=false
 *
 * @example
 * await deleteDepartment(5);
 * // Or force delete:
 * await deleteDepartment(5, true);
 */
export const deleteDepartment = async (departmentId, force = false) => {
  try {
    const response = await api.delete(`/api/departments/${departmentId}`, {
      params: { force }
    });
    return response.data;
  } catch (error) {
    console.error('Delete department failed:', error);
    throw error;
  }
};

/**
 * Bulk Assignment Operations
 */

/**
 * Bulk assign employees to department
 *
 * @param {number[]} employeeIds - Array of employee IDs to assign
 * @param {number|null} departmentId - Target department ID (null to unassign)
 * @returns {Promise<Object>} Assignment result with statistics
 * @returns {number} result.totalAttempted - Total employees processed
 * @returns {number} result.successCount - Successfully assigned
 * @returns {number} result.failureCount - Failed assignments
 * @returns {Array} result.failures - Details of failed assignments
 *
 * @example
 * const result = await bulkAssignDepartment([1, 2, 3], 5);
 * console.log(`Assigned ${result.successCount} of ${result.totalAttempted}`);
 */
export const bulkAssignDepartment = async (employeeIds, departmentId) => {
  try {
    const response = await api.post('/api/employees/bulk-assign-department', {
      employeeIds,
      departmentId
    });
    return response.data;
  } catch (error) {
    console.error('Bulk assign department failed:', error);
    throw error;
  }
};

/**
 * Transfer employees between departments
 *
 * @param {number} fromDepartmentId - Source department ID
 * @param {number} toDepartmentId - Target department ID
 * @param {number[]} [employeeIds] - Specific employees to transfer (null = all)
 * @returns {Promise<Object>} Transfer result with statistics
 *
 * @example
 * // Transfer all employees
 * await transferDepartment(5, 10);
 *
 * // Transfer specific employees
 * await transferDepartment(5, 10, [1, 2, 3]);
 */
export const transferDepartment = async (fromDepartmentId, toDepartmentId, employeeIds = null) => {
  try {
    const response = await api.post('/api/employees/transfer-department', {
      fromDepartmentId,
      toDepartmentId,
      employeeIds
    });
    return response.data;
  } catch (error) {
    console.error('Transfer department failed:', error);
    throw error;
  }
};

/**
 * Get unassigned employees
 *
 * @param {Object} [params] - Query parameters
 * @param {number} [params.skip=0] - Number of records to skip
 * @param {number} [params.limit=100] - Maximum records to return
 * @returns {Promise<Array>} List of unassigned employees
 *
 * @example
 * const unassigned = await getUnassignedEmployees({ limit: 50 });
 */
export const getUnassignedEmployees = async (params = {}) => {
  try {
    const response = await api.get('/api/employees/unassigned', { params });
    return response.data;
  } catch (error) {
    console.error('Get unassigned employees failed:', error);
    throw error;
  }
};

/**
 * Analytics Operations
 */

/**
 * Get organization-wide analytics overview
 *
 * @returns {Promise<Object>} Analytics overview
 * @returns {number} result.totalDepartments - Total number of departments
 * @returns {number} result.activeDepartments - Active departments
 * @returns {number} result.totalEmployees - Total employees across all departments
 * @returns {number} result.averageEmployeesPerDepartment - Average department size
 * @returns {number} result.maxHierarchyDepth - Maximum hierarchy depth
 * @returns {number} result.unassignedEmployees - Employees without department
 *
 * @example
 * const overview = await getDepartmentAnalyticsOverview();
 * console.log(`${overview.totalDepartments} departments`);
 * console.log(`${overview.unassignedEmployees} unassigned`);
 */
export const getDepartmentAnalyticsOverview = async () => {
  try {
    const response = await api.get('/api/departments/analytics/overview');
    return response.data;
  } catch (error) {
    console.error('Get analytics overview failed:', error);
    throw error;
  }
};

/**
 * Get employee distribution across departments
 *
 * @returns {Promise<Array>} Distribution data
 * @returns {number} result[].departmentId - Department ID
 * @returns {string} result[].departmentName - Department name
 * @returns {number} result[].employeeCount - Number of employees
 * @returns {number} result[].percentage - Percentage of total employees
 *
 * @example
 * const distribution = await getDepartmentDistribution();
 * distribution.forEach(dept => {
 *   console.log(`${dept.departmentName}: ${dept.employeeCount} (${dept.percentage}%)`);
 * });
 */
export const getDepartmentDistribution = async () => {
  try {
    const response = await api.get('/api/departments/analytics/distribution');
    return response.data;
  } catch (error) {
    console.error('Get employee distribution failed:', error);
    throw error;
  }
};

/**
 * Get department-specific analytics
 *
 * @param {number} departmentId - Department ID
 * @returns {Promise<Object>} Department analytics
 * @returns {number} result.totalEmployees - Total employees in department
 * @returns {number} result.activeEmployees - Active employees
 * @returns {Object} result.employeesByRole - Breakdown by role
 * @returns {Array} result.recentChanges - Recent assignment changes
 * @returns {number} result.hierarchyDepth - Department depth in hierarchy
 *
 * @example
 * const analytics = await getDepartmentAnalytics(5);
 * console.log(`${analytics.totalEmployees} employees`);
 * console.log('By role:', analytics.employeesByRole);
 */
export const getDepartmentAnalytics = async (departmentId) => {
  try {
    const response = await api.get(`/api/departments/${departmentId}/analytics`);
    return response.data;
  } catch (error) {
    console.error('Get department analytics failed:', error);
    throw error;
  }
};

/**
 * History Operations
 */

/**
 * Get department assignment history for employee
 *
 * @param {number} employeeId - Employee ID
 * @param {Object} [params] - Query parameters
 * @param {number} [params.limit=50] - Maximum records to return
 * @param {number} [params.offset=0] - Number of records to skip
 * @returns {Promise<Object>} History data
 * @returns {Array} result.history - Assignment history records
 * @returns {number} result.total - Total history records
 * @returns {Object} result.summary - Change summary statistics
 *
 * @example
 * const { history, total, summary } = await getEmployeeDepartmentHistory(123);
 * console.log(`${total} total changes`);
 * history.forEach(change => {
 *   console.log(`${change.changedAt}: ${change.fromDepartment?.name} → ${change.toDepartment?.name}`);
 * });
 */
export const getEmployeeDepartmentHistory = async (employeeId, params = {}) => {
  try {
    const response = await api.get(`/api/employees/${employeeId}/department-history`, { params });
    return response.data;
  } catch (error) {
    console.error('Get department history failed:', error);
    throw error;
  }
};

/**
 * Error Types
 *
 * Department-specific errors that can be thrown:
 *
 * 409 Conflict:
 *   - Department name already exists
 *   - Cannot delete department with employees (unless force=true)
 *
 * 400 Bad Request:
 *   - Department inactive (cannot assign employees)
 *   - Invalid department ID in assignment
 *   - Circular parent relationship
 *
 * 404 Not Found:
 *   - Department not found
 *   - Employee not found
 */

export default {
  // CRUD operations
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,

  // Bulk operations
  bulkAssignDepartment,
  transferDepartment,
  getUnassignedEmployees,

  // Analytics
  getDepartmentAnalyticsOverview,
  getDepartmentDistribution,
  getDepartmentAnalytics,

  // History
  getEmployeeDepartmentHistory,
};
