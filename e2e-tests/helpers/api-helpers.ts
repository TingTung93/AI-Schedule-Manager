/**
 * API Helper Functions for E2E Tests
 */

import { APIRequestContext } from '@playwright/test';

export class APIHelper {
  private request: APIRequestContext;
  private baseURL: string;
  private authToken?: string;

  constructor(request: APIRequestContext, baseURL: string = 'http://localhost:8000') {
    this.request = request;
    this.baseURL = baseURL;
  }

  async authenticate(email: string, password: string): Promise<string> {
    const response = await this.request.post(`${this.baseURL}/api/auth/login`, {
      data: { email, password }
    });
    const data = await response.json();
    this.authToken = data.access_token;
    return this.authToken;
  }

  async createTestData() {
    // Create test employees
    await this.request.post(`${this.baseURL}/api/employees`, {
      headers: { Authorization: `Bearer ${this.authToken}` },
      data: {
        name: 'Test Employee',
        email: 'test@example.com',
        role: 'Tester'
      }
    });
  }

  async cleanupTestData() {
    // Clean up test data after tests
    await this.request.delete(`${this.baseURL}/api/test/cleanup`, {
      headers: { Authorization: `Bearer ${this.authToken}` }
    });
  }

  async checkHealth(): Promise<boolean> {
    const response = await this.request.get(`${this.baseURL}/health`);
    return response.ok();
  }
}