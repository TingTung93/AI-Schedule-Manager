# Code Examples

This page provides comprehensive code examples for integrating with the AI Schedule Manager API in various programming languages.

## JavaScript/TypeScript

### Complete SDK Implementation

```typescript
interface User {
  email: string;
  role: 'manager' | 'employee';
}

interface Employee {
  id?: number;
  name: string;
  email: string;
  role: string;
  phone?: string;
  hourly_rate?: number;
  max_hours_per_week?: number;
  qualifications?: string[];
  availability_pattern?: Record<string, string[]>;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface Schedule {
  id?: number;
  employee_id: number;
  shift_id: number;
  date: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  overtime_approved?: boolean;
  employee?: Employee;
  shift?: any;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

class AIScheduleManagerSDK {
  private baseURL: string;
  private accessToken: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  // Authentication
  async login(email: string, password: string): Promise<{ user: User; access_token: string }> {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    return data;
  }

  async logout(): Promise<void> {
    await this.request('POST', '/api/auth/logout');
    this.accessToken = null;
  }

  // Generic request method with auto-refresh
  private async request<T = any>(
    method: string,
    endpoint: string,
    body?: any,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(`${this.baseURL}${endpoint}`, {
      method,
      headers,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    // Auto-refresh token if expired
    if (response.status === 401 && endpoint !== '/api/auth/refresh') {
      await this.refreshToken();
      if (this.accessToken) {
        headers.Authorization = `Bearer ${this.accessToken}`;
        response = await fetch(`${this.baseURL}${endpoint}`, {
          method,
          headers,
          credentials: 'include',
          body: body ? JSON.stringify(body) : undefined,
          ...options,
        });
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  private async refreshToken(): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      this.accessToken = data.access_token;
    }
  }

  // Employee management
  async getEmployees(params: {
    page?: number;
    size?: number;
    role?: string;
    active?: boolean;
    search?: string;
  } = {}): Promise<PaginatedResponse<Employee>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request('GET', `/api/employees?${query}`);
  }

  async getEmployee(id: number): Promise<Employee> {
    return this.request('GET', `/api/employees/${id}`);
  }

  async createEmployee(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee> {
    return this.request('POST', '/api/employees', employee);
  }

  async updateEmployee(id: number, updates: Partial<Employee>): Promise<Employee> {
    return this.request('PATCH', `/api/employees/${id}`, updates);
  }

  async deleteEmployee(id: number): Promise<{ message: string }> {
    return this.request('DELETE', `/api/employees/${id}`);
  }

  // Schedule management
  async getSchedules(params: {
    page?: number;
    size?: number;
    employee_id?: number;
    date_from?: string;
    date_to?: string;
    status?: string;
  } = {}): Promise<PaginatedResponse<Schedule>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request('GET', `/api/schedules?${query}`);
  }

  async generateSchedule(params: {
    start_date: string;
    end_date: string;
    constraints?: Record<string, any>;
  }): Promise<any> {
    return this.request('POST', '/api/schedule/generate', params);
  }

  async optimizeSchedule(scheduleId: number): Promise<any> {
    return this.request('POST', `/api/schedule/optimize?schedule_id=${scheduleId}`);
  }

  // Rule management with NLP
  async parseRule(ruleText: string): Promise<any> {
    return this.request('POST', '/api/rules/parse', { rule_text: ruleText });
  }

  async getRules(params: {
    page?: number;
    size?: number;
    rule_type?: string;
    employee_id?: number;
    active?: boolean;
  } = {}): Promise<PaginatedResponse<any>> {
    const query = new URLSearchParams(params as any).toString();
    return this.request('GET', `/api/rules?${query}`);
  }

  // Analytics
  async getAnalytics(): Promise<any> {
    return this.request('GET', '/api/analytics/overview');
  }
}

// Usage Example
const sdk = new AIScheduleManagerSDK('http://localhost:8000');

async function example() {
  try {
    // Login
    const { user } = await sdk.login('manager@example.com', 'password123');
    console.log(`Logged in as ${user.email} (${user.role})`);

    // Get employees
    const employees = await sdk.getEmployees({ page: 1, size: 10, active: true });
    console.log(`Found ${employees.total} employees`);

    // Create a new employee
    const newEmployee = await sdk.createEmployee({
      name: 'John Doe',
      email: 'john.doe@example.com',
      role: 'server',
      hourly_rate: 15.5,
      max_hours_per_week: 40,
      qualifications: ['food_safety', 'cash_handling'],
    });
    console.log(`Created employee: ${newEmployee.name}`);

    // Parse a scheduling rule
    const rule = await sdk.parseRule('John cannot work on Sundays and prefers morning shifts');
    console.log('Parsed rule:', rule);

    // Generate a schedule
    const schedule = await sdk.generateSchedule({
      start_date: '2024-01-15',
      end_date: '2024-01-21',
      constraints: {
        max_hours_per_employee: 40,
        min_coverage_ratio: 1.2,
      },
    });
    console.log('Generated schedule:', schedule);

    // Get analytics
    const analytics = await sdk.getAnalytics();
    console.log('Analytics:', analytics);

  } catch (error) {
    console.error('Error:', error);
  }
}

example();
```

### React Hook for State Management

```tsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; user: User }
  | { type: 'LOGIN_ERROR'; error: string }
  | { type: 'LOGOUT' };

const AuthContext = createContext<{
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sdk: AIScheduleManagerSDK;
} | null>(null);

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true, error: null };
    case 'LOGIN_SUCCESS':
      return { ...state, user: action.user, isAuthenticated: true, isLoading: false };
    case 'LOGIN_ERROR':
      return { ...state, error: action.error, isLoading: false };
    case 'LOGOUT':
      return { user: null, isAuthenticated: false, isLoading: false, error: null };
    default:
      return state;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });

  const sdk = new AIScheduleManagerSDK(process.env.REACT_APP_API_URL || 'http://localhost:8000');

  const login = async (email: string, password: string) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const result = await sdk.login(email, password);
      dispatch({ type: 'LOGIN_SUCCESS', user: result.user });
    } catch (error) {
      dispatch({ type: 'LOGIN_ERROR', error: error.message });
    }
  };

  const logout = async () => {
    await sdk.logout();
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ state, login, logout, sdk }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Component example
function EmployeeList() {
  const { sdk } = useAuth();
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    async function fetchEmployees() {
      try {
        const result = await sdk.getEmployees({ page: 1, size: 50 });
        setEmployees(result.items);
      } catch (error) {
        console.error('Failed to fetch employees:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchEmployees();
  }, [sdk]);

  if (loading) return <div>Loading employees...</div>;

  return (
    <div>
      <h2>Employees ({employees.length})</h2>
      {employees.map(employee => (
        <div key={employee.id} className="employee-card">
          <h3>{employee.name}</h3>
          <p>{employee.email} - {employee.role}</p>
          <p>Rate: ${employee.hourly_rate}/hr</p>
        </div>
      ))}
    </div>
  );
}
```

## Python

### Complete SDK with Async Support

```python
import asyncio
import aiohttp
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from dataclasses import dataclass

@dataclass
class User:
    email: str
    role: str

@dataclass
class Employee:
    name: str
    email: str
    role: str
    id: Optional[int] = None
    phone: Optional[str] = None
    hourly_rate: Optional[float] = None
    max_hours_per_week: Optional[int] = None
    qualifications: Optional[List[str]] = None
    availability_pattern: Optional[Dict[str, List[str]]] = None
    active: Optional[bool] = True

class AIScheduleManagerSDK:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.access_token: Optional[str] = None
        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def login(self, email: str, password: str) -> Dict[str, Any]:
        """Login and store access token"""
        data = {"email": email, "password": password}

        async with self.session.post(f"{self.base_url}/api/auth/login", json=data) as response:
            if response.status != 200:
                raise Exception(f"Login failed: {await response.text()}")

            result = await response.json()
            self.access_token = result["access_token"]
            return result

    async def logout(self) -> None:
        """Logout and clear tokens"""
        await self._request("POST", "/api/auth/logout")
        self.access_token = None

    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make authenticated request with auto-refresh"""
        headers = kwargs.get("headers", {})

        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"

        kwargs["headers"] = headers

        async with self.session.request(method, f"{self.base_url}{endpoint}", **kwargs) as response:
            # Auto-refresh token if expired
            if response.status == 401 and endpoint != "/api/auth/refresh":
                await self._refresh_token()
                headers["Authorization"] = f"Bearer {self.access_token}"
                kwargs["headers"] = headers

                async with self.session.request(method, f"{self.base_url}{endpoint}", **kwargs) as retry_response:
                    if not retry_response.ok:
                        raise Exception(f"Request failed: {await retry_response.text()}")
                    return await retry_response.json()

            if not response.ok:
                raise Exception(f"Request failed: {await response.text()}")

            return await response.json()

    async def _refresh_token(self) -> None:
        """Refresh access token"""
        async with self.session.post(f"{self.base_url}/api/auth/refresh") as response:
            if response.ok:
                result = await response.json()
                self.access_token = result["access_token"]

    # Employee management
    async def get_employees(self, **params) -> Dict[str, Any]:
        """Get paginated list of employees"""
        query_string = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
        endpoint = f"/api/employees?{query_string}" if query_string else "/api/employees"
        return await self._request("GET", endpoint)

    async def get_employee(self, employee_id: int) -> Dict[str, Any]:
        """Get employee by ID"""
        return await self._request("GET", f"/api/employees/{employee_id}")

    async def create_employee(self, employee_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new employee"""
        return await self._request("POST", "/api/employees", json=employee_data)

    async def update_employee(self, employee_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update employee"""
        return await self._request("PATCH", f"/api/employees/{employee_id}", json=updates)

    async def delete_employee(self, employee_id: int) -> Dict[str, Any]:
        """Delete employee"""
        return await self._request("DELETE", f"/api/employees/{employee_id}")

    # Schedule management
    async def get_schedules(self, **params) -> Dict[str, Any]:
        """Get paginated list of schedules"""
        query_string = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
        endpoint = f"/api/schedules?{query_string}" if query_string else "/api/schedules"
        return await self._request("GET", endpoint)

    async def generate_schedule(self, start_date: str, end_date: str, constraints: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate AI-optimized schedule"""
        data = {
            "start_date": start_date,
            "end_date": end_date,
            "constraints": constraints or {}
        }
        return await self._request("POST", "/api/schedule/generate", json=data)

    async def optimize_schedule(self, schedule_id: int) -> Dict[str, Any]:
        """Optimize existing schedule"""
        return await self._request("POST", f"/api/schedule/optimize?schedule_id={schedule_id}")

    # Rule management
    async def parse_rule(self, rule_text: str) -> Dict[str, Any]:
        """Parse natural language rule"""
        return await self._request("POST", "/api/rules/parse", json={"rule_text": rule_text})

    async def get_rules(self, **params) -> Dict[str, Any]:
        """Get paginated list of rules"""
        query_string = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
        endpoint = f"/api/rules?{query_string}" if query_string else "/api/rules"
        return await self._request("GET", endpoint)

    # Analytics
    async def get_analytics(self) -> Dict[str, Any]:
        """Get analytics overview"""
        return await self._request("GET", "/api/analytics/overview")

# Usage examples
async def main():
    async with AIScheduleManagerSDK("http://localhost:8000") as sdk:
        try:
            # Login
            user_data = await sdk.login("manager@example.com", "password123")
            print(f"Logged in as: {user_data['user']['email']}")

            # Get employees
            employees = await sdk.get_employees(page=1, size=10, active=True)
            print(f"Found {employees['total']} employees")

            # Create new employee
            new_employee = {
                "name": "Jane Smith",
                "email": "jane.smith@example.com",
                "role": "cook",
                "hourly_rate": 18.0,
                "qualifications": ["food_safety", "knife_skills"]
            }

            created = await sdk.create_employee(new_employee)
            print(f"Created employee: {created['name']} (ID: {created['id']})")

            # Parse a natural language rule
            rule = await sdk.parse_rule("Jane prefers to work weekends and cannot work before 10 AM")
            print(f"Parsed rule: {rule['constraints']}")

            # Generate schedule
            schedule = await sdk.generate_schedule(
                start_date="2024-01-15",
                end_date="2024-01-21",
                constraints={
                    "max_hours_per_employee": 40,
                    "preferred_shift_length": 8
                }
            )
            print(f"Generated schedule ID: {schedule['id']}")

            # Get analytics
            analytics = await sdk.get_analytics()
            print(f"Analytics: {analytics['total_employees']} employees, {analytics['optimization_score']}% optimization")

        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
```

### Django Integration

```python
# views.py
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import asyncio
from .sdk import AIScheduleManagerSDK

@csrf_exempt
@require_http_methods(["POST"])
async def create_employee_view(request):
    try:
        data = json.loads(request.body)

        async with AIScheduleManagerSDK("http://localhost:8000") as sdk:
            # Login with service account
            await sdk.login(
                email=settings.SERVICE_ACCOUNT_EMAIL,
                password=settings.SERVICE_ACCOUNT_PASSWORD
            )

            # Create employee
            employee = await sdk.create_employee(data)

            return JsonResponse({
                "success": True,
                "employee": employee
            })

    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=400)

# models.py
from django.db import models

class ScheduleSync(models.Model):
    local_employee_id = models.IntegerField()
    api_employee_id = models.IntegerField()
    last_sync = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('local_employee_id', 'api_employee_id')

# tasks.py (Celery)
from celery import shared_task
from .sdk import AIScheduleManagerSDK

@shared_task
async def sync_employees():
    """Periodic task to sync employees with AI Schedule Manager"""
    async with AIScheduleManagerSDK("http://localhost:8000") as sdk:
        await sdk.login(
            email=settings.SERVICE_ACCOUNT_EMAIL,
            password=settings.SERVICE_ACCOUNT_PASSWORD
        )

        # Get all employees from API
        employees = await sdk.get_employees(size=100)

        for employee in employees['items']:
            # Sync with local database
            ScheduleSync.objects.update_or_create(
                api_employee_id=employee['id'],
                defaults={
                    'local_employee_id': employee['external_id'],
                    'last_sync': timezone.now()
                }
            )
```

## PHP

### Complete SDK Implementation

```php
<?php

class AIScheduleManagerSDK {
    private $baseUrl;
    private $accessToken;
    private $httpClient;

    public function __construct($baseUrl) {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->httpClient = new \GuzzleHttp\Client([
            'timeout' => 30,
            'verify' => true,
        ]);
    }

    public function login($email, $password) {
        $response = $this->httpClient->post($this->baseUrl . '/api/auth/login', [
            'json' => [
                'email' => $email,
                'password' => $password
            ]
        ]);

        $data = json_decode($response->getBody(), true);
        $this->accessToken = $data['access_token'];

        return $data;
    }

    public function logout() {
        $this->request('POST', '/api/auth/logout');
        $this->accessToken = null;
    }

    private function request($method, $endpoint, $data = null, $retry = true) {
        $options = [
            'headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ]
        ];

        if ($this->accessToken) {
            $options['headers']['Authorization'] = 'Bearer ' . $this->accessToken;
        }

        if ($data) {
            $options['json'] = $data;
        }

        try {
            $response = $this->httpClient->request($method, $this->baseUrl . $endpoint, $options);
            return json_decode($response->getBody(), true);

        } catch (\GuzzleHttp\Exception\ClientException $e) {
            if ($e->getResponse()->getStatusCode() === 401 && $retry) {
                // Try to refresh token
                $this->refreshToken();
                return $this->request($method, $endpoint, $data, false);
            }
            throw $e;
        }
    }

    private function refreshToken() {
        try {
            $response = $this->httpClient->post($this->baseUrl . '/api/auth/refresh');
            $data = json_decode($response->getBody(), true);
            $this->accessToken = $data['access_token'];
        } catch (\Exception $e) {
            // Refresh failed, need to login again
            $this->accessToken = null;
            throw new \Exception('Token refresh failed. Please login again.');
        }
    }

    // Employee management
    public function getEmployees($params = []) {
        $query = http_build_query($params);
        $endpoint = '/api/employees' . ($query ? '?' . $query : '');
        return $this->request('GET', $endpoint);
    }

    public function getEmployee($id) {
        return $this->request('GET', "/api/employees/{$id}");
    }

    public function createEmployee($employeeData) {
        return $this->request('POST', '/api/employees', $employeeData);
    }

    public function updateEmployee($id, $updates) {
        return $this->request('PATCH', "/api/employees/{$id}", $updates);
    }

    public function deleteEmployee($id) {
        return $this->request('DELETE', "/api/employees/{$id}");
    }

    // Schedule management
    public function getSchedules($params = []) {
        $query = http_build_query($params);
        $endpoint = '/api/schedules' . ($query ? '?' . $query : '');
        return $this->request('GET', $endpoint);
    }

    public function generateSchedule($startDate, $endDate, $constraints = []) {
        $data = [
            'start_date' => $startDate,
            'end_date' => $endDate,
            'constraints' => $constraints
        ];
        return $this->request('POST', '/api/schedule/generate', $data);
    }

    public function optimizeSchedule($scheduleId) {
        return $this->request('POST', "/api/schedule/optimize?schedule_id={$scheduleId}");
    }

    // Rule management
    public function parseRule($ruleText) {
        return $this->request('POST', '/api/rules/parse', ['rule_text' => $ruleText]);
    }

    public function getRules($params = []) {
        $query = http_build_query($params);
        $endpoint = '/api/rules' . ($query ? '?' . $query : '');
        return $this->request('GET', $endpoint);
    }

    // Analytics
    public function getAnalytics() {
        return $this->request('GET', '/api/analytics/overview');
    }
}

// Usage example
try {
    $sdk = new AIScheduleManagerSDK('http://localhost:8000');

    // Login
    $userData = $sdk->login('manager@example.com', 'password123');
    echo "Logged in as: " . $userData['user']['email'] . "\n";

    // Get employees
    $employees = $sdk->getEmployees(['page' => 1, 'size' => 10]);
    echo "Found " . $employees['total'] . " employees\n";

    // Create new employee
    $newEmployee = [
        'name' => 'Bob Johnson',
        'email' => 'bob.johnson@example.com',
        'role' => 'cashier',
        'hourly_rate' => 14.5,
        'qualifications' => ['pos_system', 'customer_service']
    ];

    $created = $sdk->createEmployee($newEmployee);
    echo "Created employee: " . $created['name'] . " (ID: " . $created['id'] . ")\n";

    // Parse rule
    $rule = $sdk->parseRule('Bob works best in the evening and cannot work on Mondays');
    echo "Parsed rule constraints: " . json_encode($rule['constraints']) . "\n";

    // Generate schedule
    $schedule = $sdk->generateSchedule('2024-01-15', '2024-01-21', [
        'max_hours_per_employee' => 40,
        'min_coverage_ratio' => 1.1
    ]);
    echo "Generated schedule ID: " . $schedule['id'] . "\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
```

### Laravel Integration

```php
<?php

// Service Provider
namespace App\Providers;

use App\Services\AIScheduleManagerService;
use Illuminate\Support\ServiceProvider;

class AIScheduleManagerServiceProvider extends ServiceProvider {
    public function register() {
        $this->app->singleton(AIScheduleManagerService::class, function ($app) {
            return new AIScheduleManagerService(config('services.ai_schedule_manager.base_url'));
        });
    }
}

// Service class
namespace App\Services;

class AIScheduleManagerService extends AIScheduleManagerSDK {
    public function __construct($baseUrl) {
        parent::__construct($baseUrl);

        // Auto-login with service account
        $this->login(
            config('services.ai_schedule_manager.email'),
            config('services.ai_schedule_manager.password')
        );
    }
}

// Controller
namespace App\Http\Controllers;

use App\Services\AIScheduleManagerService;
use Illuminate\Http\Request;

class EmployeeController extends Controller {
    private $scheduleService;

    public function __construct(AIScheduleManagerService $scheduleService) {
        $this->scheduleService = $scheduleService;
    }

    public function index(Request $request) {
        $params = $request->only(['page', 'size', 'role', 'active', 'search']);
        $employees = $this->scheduleService->getEmployees($params);

        return response()->json($employees);
    }

    public function store(Request $request) {
        $request->validate([
            'name' => 'required|string|max:100',
            'email' => 'required|email|unique:employees',
            'role' => 'required|string',
            'hourly_rate' => 'nullable|numeric|min:0',
        ]);

        $employee = $this->scheduleService->createEmployee($request->all());

        return response()->json($employee, 201);
    }
}

// Job for background processing
namespace App\Jobs;

use App\Services\AIScheduleManagerService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class GenerateWeeklySchedule implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    private $startDate;
    private $endDate;
    private $constraints;

    public function __construct($startDate, $endDate, $constraints = []) {
        $this->startDate = $startDate;
        $this->endDate = $endDate;
        $this->constraints = $constraints;
    }

    public function handle(AIScheduleManagerService $scheduleService) {
        $schedule = $scheduleService->generateSchedule(
            $this->startDate,
            $this->endDate,
            $this->constraints
        );

        // Store or process the generated schedule
        \Log::info('Schedule generated', ['schedule_id' => $schedule['id']]);
    }
}
```

## Go

### Complete SDK Implementation

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "net/url"
    "time"
)

type User struct {
    Email string `json:"email"`
    Role  string `json:"role"`
}

type Employee struct {
    ID                 *int               `json:"id,omitempty"`
    Name              string             `json:"name"`
    Email             string             `json:"email"`
    Role              string             `json:"role"`
    Phone             *string            `json:"phone,omitempty"`
    HourlyRate        *float64           `json:"hourly_rate,omitempty"`
    MaxHoursPerWeek   *int               `json:"max_hours_per_week,omitempty"`
    Qualifications    []string           `json:"qualifications,omitempty"`
    AvailabilityPattern map[string][]string `json:"availability_pattern,omitempty"`
    Active            *bool              `json:"active,omitempty"`
    CreatedAt         *time.Time         `json:"created_at,omitempty"`
    UpdatedAt         *time.Time         `json:"updated_at,omitempty"`
}

type PaginatedResponse struct {
    Items []json.RawMessage `json:"items"`
    Total int               `json:"total"`
    Page  int               `json:"page"`
    Size  int               `json:"size"`
    Pages int               `json:"pages"`
}

type AIScheduleManagerSDK struct {
    BaseURL     string
    AccessToken string
    HTTPClient  *http.Client
}

func NewAIScheduleManagerSDK(baseURL string) *AIScheduleManagerSDK {
    return &AIScheduleManagerSDK{
        BaseURL: baseURL,
        HTTPClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

func (sdk *AIScheduleManagerSDK) Login(email, password string) (*User, error) {
    data := map[string]string{
        "email":    email,
        "password": password,
    }

    response, err := sdk.request("POST", "/api/auth/login", data, false)
    if err != nil {
        return nil, err
    }

    var result struct {
        AccessToken string `json:"access_token"`
        User        User   `json:"user"`
    }

    if err := json.Unmarshal(response, &result); err != nil {
        return nil, err
    }

    sdk.AccessToken = result.AccessToken
    return &result.User, nil
}

func (sdk *AIScheduleManagerSDK) Logout() error {
    _, err := sdk.request("POST", "/api/auth/logout", nil, true)
    if err == nil {
        sdk.AccessToken = ""
    }
    return err
}

func (sdk *AIScheduleManagerSDK) request(method, endpoint string, body interface{}, useAuth bool) ([]byte, error) {
    var reqBody io.Reader

    if body != nil {
        jsonData, err := json.Marshal(body)
        if err != nil {
            return nil, err
        }
        reqBody = bytes.NewBuffer(jsonData)
    }

    req, err := http.NewRequest(method, sdk.BaseURL+endpoint, reqBody)
    if err != nil {
        return nil, err
    }

    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Accept", "application/json")

    if useAuth && sdk.AccessToken != "" {
        req.Header.Set("Authorization", "Bearer "+sdk.AccessToken)
    }

    resp, err := sdk.HTTPClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    responseBody, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }

    if resp.StatusCode >= 400 {
        return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(responseBody))
    }

    return responseBody, nil
}

// Employee management
func (sdk *AIScheduleManagerSDK) GetEmployees(params map[string]string) (*PaginatedResponse, error) {
    query := url.Values{}
    for k, v := range params {
        query.Add(k, v)
    }

    endpoint := "/api/employees"
    if len(query) > 0 {
        endpoint += "?" + query.Encode()
    }

    response, err := sdk.request("GET", endpoint, nil, true)
    if err != nil {
        return nil, err
    }

    var result PaginatedResponse
    if err := json.Unmarshal(response, &result); err != nil {
        return nil, err
    }

    return &result, nil
}

func (sdk *AIScheduleManagerSDK) GetEmployee(id int) (*Employee, error) {
    endpoint := fmt.Sprintf("/api/employees/%d", id)
    response, err := sdk.request("GET", endpoint, nil, true)
    if err != nil {
        return nil, err
    }

    var employee Employee
    if err := json.Unmarshal(response, &employee); err != nil {
        return nil, err
    }

    return &employee, nil
}

func (sdk *AIScheduleManagerSDK) CreateEmployee(employee Employee) (*Employee, error) {
    response, err := sdk.request("POST", "/api/employees", employee, true)
    if err != nil {
        return nil, err
    }

    var created Employee
    if err := json.Unmarshal(response, &created); err != nil {
        return nil, err
    }

    return &created, nil
}

func (sdk *AIScheduleManagerSDK) UpdateEmployee(id int, updates map[string]interface{}) (*Employee, error) {
    endpoint := fmt.Sprintf("/api/employees/%d", id)
    response, err := sdk.request("PATCH", endpoint, updates, true)
    if err != nil {
        return nil, err
    }

    var updated Employee
    if err := json.Unmarshal(response, &updated); err != nil {
        return nil, err
    }

    return &updated, nil
}

// Schedule management
func (sdk *AIScheduleManagerSDK) GenerateSchedule(startDate, endDate string, constraints map[string]interface{}) (map[string]interface{}, error) {
    data := map[string]interface{}{
        "start_date":  startDate,
        "end_date":    endDate,
        "constraints": constraints,
    }

    response, err := sdk.request("POST", "/api/schedule/generate", data, true)
    if err != nil {
        return nil, err
    }

    var result map[string]interface{}
    if err := json.Unmarshal(response, &result); err != nil {
        return nil, err
    }

    return result, nil
}

func (sdk *AIScheduleManagerSDK) ParseRule(ruleText string) (map[string]interface{}, error) {
    data := map[string]string{
        "rule_text": ruleText,
    }

    response, err := sdk.request("POST", "/api/rules/parse", data, true)
    if err != nil {
        return nil, err
    }

    var result map[string]interface{}
    if err := json.Unmarshal(response, &result); err != nil {
        return nil, err
    }

    return result, nil
}

// Usage example
func main() {
    sdk := NewAIScheduleManagerSDK("http://localhost:8000")

    // Login
    user, err := sdk.Login("manager@example.com", "password123")
    if err != nil {
        fmt.Printf("Login failed: %v\n", err)
        return
    }
    fmt.Printf("Logged in as: %s (%s)\n", user.Email, user.Role)

    // Get employees
    employees, err := sdk.GetEmployees(map[string]string{
        "page": "1",
        "size": "10",
        "active": "true",
    })
    if err != nil {
        fmt.Printf("Failed to get employees: %v\n", err)
        return
    }
    fmt.Printf("Found %d employees\n", employees.Total)

    // Create new employee
    newEmployee := Employee{
        Name:            "Alice Wilson",
        Email:           "alice.wilson@example.com",
        Role:            "supervisor",
        HourlyRate:      func(f float64) *float64 { return &f }(20.0),
        MaxHoursPerWeek: func(i int) *int { return &i }(45),
        Qualifications:  []string{"leadership", "food_safety", "scheduling"},
    }

    created, err := sdk.CreateEmployee(newEmployee)
    if err != nil {
        fmt.Printf("Failed to create employee: %v\n", err)
        return
    }
    fmt.Printf("Created employee: %s (ID: %d)\n", created.Name, *created.ID)

    // Parse a rule
    rule, err := sdk.ParseRule("Alice prefers to work evening shifts and needs Fridays off")
    if err != nil {
        fmt.Printf("Failed to parse rule: %v\n", err)
        return
    }
    fmt.Printf("Parsed rule: %+v\n", rule)

    // Generate schedule
    schedule, err := sdk.GenerateSchedule("2024-01-15", "2024-01-21", map[string]interface{}{
        "max_hours_per_employee": 40,
        "min_coverage_ratio":     1.2,
    })
    if err != nil {
        fmt.Printf("Failed to generate schedule: %v\n", err)
        return
    }
    fmt.Printf("Generated schedule: %+v\n", schedule)
}
```

These comprehensive code examples provide complete SDKs and integration patterns for the most popular programming languages, demonstrating how to:

1. **Authenticate** with the API using JWT tokens
2. **Handle token refresh** automatically
3. **Make CRUD operations** for employees, schedules, and rules
4. **Use AI features** like natural language rule parsing and schedule optimization
5. **Handle errors** and edge cases properly
6. **Integrate** with popular frameworks and libraries

Each example includes production-ready error handling, async support where applicable, and follows language-specific best practices.