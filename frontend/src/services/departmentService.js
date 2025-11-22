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
 * Get department-specific analytics (legacy, basic analytics)
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
export const getDepartmentAnalytics = async (departmentId, startDate = null, endDate = null, params = {}) => {
  try {
    // If dates are provided, fetch comprehensive schedule analytics
    if (startDate && endDate) {
      const response = await api.get(`/api/departments/${departmentId}/schedule-analytics`, {
        params: {
          startDate,
          endDate,
          ...params
        }
      });
      return response.data;
    }

    // Otherwise, return basic department analytics
    const response = await api.get(`/api/departments/${departmentId}/analytics`);
    return response.data;
  } catch (error) {
    console.error('Get department analytics failed:', error);
    throw error;
  }
};

/**
 * Export analytics report in specified format
 *
 * @param {number} departmentId - Department ID
 * @param {string} format - Export format ('pdf', 'excel', or 'csv')
 * @returns {Promise<Blob>} File download blob
 *
 * @example
 * await exportAnalyticsReport(5, 'pdf');
 * // Browser will download the PDF report
 */
export const exportAnalyticsReport = async (departmentId, format = 'pdf') => {
  try {
    const response = await api.get(`/api/departments/${departmentId}/analytics/export`, {
      params: { format },
      responseType: 'blob'
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;

    const extension = format === 'excel' ? 'xlsx' : format;
    link.setAttribute('download', `department-${departmentId}-analytics.${extension}`);

    document.body.appendChild(link);
    link.click();
    link.remove();

    return response.data;
  } catch (error) {
    console.error('Export analytics report failed:', error);
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
 * Department Schedule Operations
 */

/**
 * Bulk assign employees to a department with reason tracking
 *
 * @param {number} departmentId - Target department ID
 * @param {number[]} employeeIds - Array of employee IDs to assign
 * @param {string} [reason] - Reason for bulk assignment
 * @returns {Promise<Object>} Assignment result
 * @returns {boolean} result.success - Whether operation succeeded
 * @returns {number} result.assignedCount - Number of employees successfully assigned
 * @returns {Array} result.assignments - Details of each assignment
 *
 * @example
 * const result = await bulkAssignEmployees(10, [1, 2, 3, 4], 'Team reorganization');
 * console.log(`Assigned ${result.assignedCount} employees to department`);
 */
export const bulkAssignEmployees = async (departmentId, employeeIds, reason = null) => {
  try {
    const response = await api.post(`/api/departments/${departmentId}/employees/bulk-assign`, {
      employeeIds,
      reason
    });
    return response.data;
  } catch (error) {
    console.error('Bulk assign employees failed:', error);
    throw error;
  }
};

/**
 * Transfer employee from one department to another
 *
 * @param {number} departmentId - Source department ID
 * @param {number} employeeId - Employee ID to transfer
 * @param {number} toDepartmentId - Target department ID
 * @param {string} [reason] - Reason for transfer
 * @returns {Promise<Object>} Transfer result
 * @returns {boolean} result.success - Whether transfer succeeded
 * @returns {Object} result.employee - Employee details
 * @returns {number} result.previousDepartmentId - Previous department
 * @returns {number} result.newDepartmentId - New department
 *
 * @example
 * const result = await transferEmployee(5, 123, 10, 'Better skill match');
 * console.log(`Employee transferred from ${result.previousDepartmentId} to ${result.newDepartmentId}`);
 */
export const transferEmployee = async (departmentId, employeeId, toDepartmentId, reason = null) => {
  try {
    const response = await api.post(`/api/departments/${departmentId}/employees/${employeeId}/transfer`, {
      toDepartmentId,
      reason
    });
    return response.data;
  } catch (error) {
    console.error('Transfer employee failed:', error);
    throw error;
  }
};

/**
 * Get all schedules for a department
 *
 * @param {number} departmentId - Department ID
 * @param {Object} [params] - Query parameters
 * @param {number} [params.page=1] - Page number
 * @param {number} [params.size=10] - Items per page
 * @param {string} [params.startDate] - Filter by start date (YYYY-MM-DD)
 * @param {string} [params.endDate] - Filter by end date (YYYY-MM-DD)
 * @param {string} [params.status] - Filter by schedule status
 * @returns {Promise<Object>} Paginated schedules
 * @returns {Array} result.items - Schedule list
 * @returns {number} result.total - Total number of schedules
 * @returns {number} result.page - Current page
 * @returns {number} result.size - Items per page
 *
 * @example
 * const { items, total } = await getDepartmentSchedules(10, {
 *   startDate: '2025-11-01',
 *   endDate: '2025-11-30',
 *   status: 'published'
 * });
 */
export const getDepartmentSchedules = async (departmentId, params = {}) => {
  try {
    const response = await api.get(`/api/departments/${departmentId}/schedules`, { params });
    return response.data;
  } catch (error) {
    console.error('Get department schedules failed:', error);
    throw error;
  }
};

/**
 * Create a new schedule for a department
 *
 * @param {number} departmentId - Department ID
 * @param {Object} scheduleData - Schedule data
 * @param {string} scheduleData.name - Schedule name
 * @param {string} scheduleData.startDate - Start date (YYYY-MM-DD)
 * @param {string} scheduleData.endDate - End date (YYYY-MM-DD)
 * @param {number} [scheduleData.templateId] - Template ID to apply
 * @param {string} [scheduleData.notes] - Additional notes
 * @returns {Promise<Object>} Created schedule
 *
 * @example
 * const schedule = await createDepartmentSchedule(10, {
 *   name: 'Sales Floor - Holiday Week',
 *   startDate: '2025-12-23',
 *   endDate: '2025-12-29',
 *   templateId: 5,
 *   notes: 'Extra coverage for holiday shopping'
 * });
 */
export const createDepartmentSchedule = async (departmentId, scheduleData) => {
  try {
    const response = await api.post(`/api/departments/${departmentId}/schedules`, scheduleData);
    return response.data;
  } catch (error) {
    console.error('Create department schedule failed:', error);
    throw error;
  }
};

/**
 * Get consolidated schedule overview for a department
 *
 * @param {number} departmentId - Department ID
 * @param {string} startDate - Start of date range (YYYY-MM-DD)
 * @param {string} endDate - End of date range (YYYY-MM-DD)
 * @param {Object} [params] - Additional parameters
 * @param {boolean} [params.includeMetrics=false] - Include coverage analytics
 * @returns {Promise<Object>} Schedule overview
 * @returns {number} result.departmentId - Department ID
 * @returns {string} result.departmentName - Department name
 * @returns {Object} result.dateRange - Date range
 * @returns {Array} result.employees - Employee schedules
 * @returns {Object} [result.metrics] - Coverage metrics (if includeMetrics=true)
 *
 * @example
 * const overview = await getDepartmentScheduleOverview(10, '2025-11-25', '2025-12-01', {
 *   includeMetrics: true
 * });
 * console.log(`Coverage: ${overview.metrics.coveragePercentage}%`);
 */
export const getDepartmentScheduleOverview = async (departmentId, startDate, endDate, params = {}) => {
  try {
    const response = await api.get(`/api/departments/${departmentId}/schedule-overview`, {
      params: { startDate, endDate, ...params }
    });
    return response.data;
  } catch (error) {
    console.error('Get department schedule overview failed:', error);
    throw error;
  }
};

/**
 * Get schedule templates for a department
 *
 * @param {number} departmentId - Department ID
 * @param {Object} [params] - Query parameters
 * @param {boolean} [params.activeOnly=true] - Only return active templates
 * @param {string} [params.patternType] - Filter by pattern type (weekly, rotating, custom)
 * @returns {Promise<Array>} List of schedule templates
 *
 * @example
 * const templates = await getDepartmentTemplates(10, { activeOnly: true });
 * templates.forEach(template => {
 *   console.log(`${template.name} - ${template.patternType}`);
 * });
 */
export const getDepartmentTemplates = async (departmentId, params = {}) => {
  try {
    const response = await api.get(`/api/departments/${departmentId}/templates`, { params });
    return response.data;
  } catch (error) {
    console.error('Get department templates failed:', error);
    throw error;
  }
};

/**
 * Create a new schedule template for a department
 *
 * @param {number} departmentId - Department ID
 * @param {Object} templateData - Template data
 * @param {string} templateData.name - Template name
 * @param {string} [templateData.description] - Template description
 * @param {Object} templateData.templateData - Template configuration (shift patterns, etc.)
 * @param {string} [templateData.patternType='custom'] - Pattern type (weekly, rotating, custom)
 * @param {number} [templateData.rotationDays] - Days in rotation cycle (for rotating patterns)
 * @param {boolean} [templateData.isActive=true] - Whether template is active
 * @returns {Promise<Object>} Created template
 *
 * @example
 * const template = await createDepartmentTemplate(10, {
 *   name: 'Standard Retail Week',
 *   description: '5-day rotating shifts',
 *   templateData: { shifts: [...] },
 *   patternType: 'rotating',
 *   rotationDays: 7
 * });
 */
export const createDepartmentTemplate = async (departmentId, templateData) => {
  try {
    const response = await api.post(`/api/departments/${departmentId}/templates`, templateData);
    return response.data;
  } catch (error) {
    console.error('Create department template failed:', error);
    throw error;
  }
};

/**
 * Apply a template to create a new schedule
 *
 * @param {number} departmentId - Department ID
 * @param {number} templateId - Template ID to apply
 * @param {Object} params - Application parameters
 * @param {string} params.startDate - Schedule start date (YYYY-MM-DD)
 * @param {string} params.endDate - Schedule end date (YYYY-MM-DD)
 * @param {string} [params.name] - Custom schedule name (defaults to template name)
 * @param {Object} [params.overrides] - Template overrides
 * @returns {Promise<Object>} Created schedule from template
 *
 * @example
 * const schedule = await applyDepartmentTemplate(10, 5, {
 *   startDate: '2025-12-01',
 *   endDate: '2025-12-07',
 *   name: 'Week 49 Schedule'
 * });
 */
export const applyDepartmentTemplate = async (departmentId, templateId, params) => {
  try {
    const response = await api.post(`/api/departments/${departmentId}/templates/${templateId}/apply`, params);
    return response.data;
  } catch (error) {
    console.error('Apply department template failed:', error);
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

  // Department-specific assignment operations
  bulkAssignEmployees,
  transferEmployee,

  // Department schedule operations
  getDepartmentSchedules,
  createDepartmentSchedule,
  getDepartmentScheduleOverview,
  getDepartmentTemplates,
  createDepartmentTemplate,
  applyDepartmentTemplate,
};
