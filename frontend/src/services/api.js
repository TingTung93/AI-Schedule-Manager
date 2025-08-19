import axios from 'axios';

// Create axios instance with default config
const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    // Extract error message
    const message = error.response?.data?.detail || 
                   error.response?.data?.message || 
                   error.message || 
                   'An unexpected error occurred';
    
    return Promise.reject({ ...error, message });
  }
);

// Authentication services
export const authService = {
  async login(email, password) {
    const response = await API.post('/api/auth/login', { email, password });
    const { access_token, user } = response.data;
    
    // Store token and user info
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(user));
    
    return { token: access_token, user };
  },
  
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
  
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
  
  isAuthenticated() {
    return !!localStorage.getItem('token');
  }
};

// Rule management services
export const ruleService = {
  async parseRule(ruleText) {
    const response = await API.post('/api/rules/parse', { rule_text: ruleText });
    return response.data;
  },
  
  async getRules() {
    const response = await API.get('/api/rules');
    return response.data;
  },
  
  async deleteRule(ruleId) {
    const response = await API.delete(`/api/rules/${ruleId}`);
    return response.data;
  },
  
  async updateRule(ruleId, updates) {
    const response = await API.patch(`/api/rules/${ruleId}`, updates);
    return response.data;
  }
};

// Schedule services
export const scheduleService = {
  async generateSchedule(startDate, endDate) {
    const response = await API.post('/api/schedule/generate', {
      start_date: startDate,
      end_date: endDate,
    });
    return response.data;
  },
  
  async optimizeSchedule(scheduleId) {
    const response = await API.post('/api/schedule/optimize', null, {
      params: { schedule_id: scheduleId }
    });
    return response.data;
  },
  
  async getSchedule(scheduleId) {
    const response = await API.get(`/api/schedule/${scheduleId}`);
    return response.data;
  },
  
  async getSchedules() {
    const response = await API.get('/api/schedules');
    return response.data;
  },
  
  async updateShift(scheduleId, shiftId, updates) {
    const response = await API.patch(`/api/schedule/${scheduleId}/shift/${shiftId}`, updates);
    return response.data;
  }
};

// Employee services
export const employeeService = {
  async getEmployees() {
    const response = await API.get('/api/employees');
    return response.data;
  },
  
  async createEmployee(employee) {
    const response = await API.post('/api/employees', employee);
    return response.data;
  },
  
  async updateEmployee(employeeId, updates) {
    const response = await API.patch(`/api/employees/${employeeId}`, updates);
    return response.data;
  },
  
  async deleteEmployee(employeeId) {
    const response = await API.delete(`/api/employees/${employeeId}`);
    return response.data;
  },
  
  async getEmployeeSchedule(employeeId, startDate, endDate) {
    const response = await API.get(`/api/employees/${employeeId}/schedule`, {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  }
};

// Analytics services
export const analyticsService = {
  async getOverview() {
    const response = await API.get('/api/analytics/overview');
    return response.data;
  },
  
  async getLaborCosts(period = '7d') {
    const response = await API.get('/api/analytics/labor-costs', {
      params: { period }
    });
    return response.data;
  },
  
  async getOptimizationMetrics() {
    const response = await API.get('/api/analytics/optimization');
    return response.data;
  },
  
  async getEmployeeMetrics(employeeId) {
    const response = await API.get(`/api/analytics/employee/${employeeId}`);
    return response.data;
  }
};

// Notification services
export const notificationService = {
  async getNotifications() {
    const response = await API.get('/api/notifications');
    return response.data;
  },
  
  async markAsRead(notificationId) {
    const response = await API.patch(`/api/notifications/${notificationId}/read`);
    return response.data;
  },
  
  async markAllAsRead() {
    const response = await API.post('/api/notifications/read-all');
    return response.data;
  },
  
  async deleteNotification(notificationId) {
    const response = await API.delete(`/api/notifications/${notificationId}`);
    return response.data;
  }
};

// Export default API instance for custom requests
export default API;