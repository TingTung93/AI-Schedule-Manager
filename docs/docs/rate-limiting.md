# Rate Limiting

The AI Schedule Manager API implements comprehensive rate limiting to ensure fair usage, prevent abuse, and maintain system performance for all users.

## Overview

Rate limiting is applied based on:
- **IP address** for authentication endpoints
- **User account** for authenticated endpoints
- **API key** for service-to-service calls
- **Endpoint type** with different limits for various operations

## Rate Limit Tiers

### Authentication Endpoints

These endpoints have stricter limits to prevent brute force attacks:

| Endpoint | Limit | Window | Scope |
|----------|-------|--------|-------|
| `POST /api/auth/login` | 5 requests | 5 minutes | Per IP |
| `POST /api/auth/refresh` | 10 requests | 1 hour | Per user |
| `POST /api/auth/forgot-password` | 3 requests | 1 hour | Per IP |
| `POST /api/auth/reset-password` | 5 requests | 1 hour | Per IP |
| `POST /api/auth/register` | 3 requests | 5 minutes | Per IP |

### General API Endpoints

Standard CRUD operations have moderate limits:

| User Role | Requests | Window | Scope |
|-----------|----------|--------|-------|
| Employee | 100 requests | 1 hour | Per user |
| Manager | 500 requests | 1 hour | Per user |
| Service Account | 1000 requests | 1 hour | Per API key |

### Resource-Intensive Endpoints

AI-powered and computationally expensive operations:

| Endpoint | Limit | Window | Role Required |
|----------|-------|--------|---------------|
| `POST /api/schedule/generate` | 10 requests | 1 hour | Manager |
| `POST /api/schedule/optimize` | 20 requests | 1 hour | Manager |
| `POST /api/rules/parse` | 50 requests | 1 hour | Any authenticated |
| `GET /api/analytics/overview` | 30 requests | 1 hour | Manager |

### WebSocket Connections

Real-time connection limits:

| Limit Type | Value | Scope |
|------------|-------|-------|
| Concurrent connections | 3 per user | Per user account |
| Connection rate | 5 per minute | Per IP address |
| Message rate | 100 per minute | Per connection |
| Subscription rate | 10 per minute | Per connection |

## Rate Limit Headers

All API responses include rate limit information in headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1640995200
X-RateLimit-Window: 3600
```

### Header Descriptions

- **X-RateLimit-Limit**: Maximum requests allowed in the current window
- **X-RateLimit-Remaining**: Requests remaining in the current window
- **X-RateLimit-Reset**: Unix timestamp when the window resets
- **X-RateLimit-Window**: Window duration in seconds

## Rate Limit Exceeded Response

When rate limits are exceeded, the API returns:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60

{
  "detail": "Rate limit exceeded. Try again in 60 seconds.",
  "limit": 100,
  "window": 3600,
  "reset": 1640995200,
  "retry_after": 60
}
```

## Implementation Examples

### JavaScript/TypeScript

```typescript
class RateLimitHandler {
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private lastReset = 0;
  private remaining = 0;
  private limit = 0;

  async makeRequest(requestFn: () => Promise<Response>): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const response = await requestFn();
          this.updateRateLimitInfo(response);

          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
            await this.delay(retryAfter * 1000);
            return this.makeRequest(requestFn);
          }

          resolve(response);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private updateRateLimitInfo(response: Response) {
    this.limit = parseInt(response.headers.get('X-RateLimit-Limit') || '0');
    this.remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
    this.lastReset = parseInt(response.headers.get('X-RateLimit-Reset') || '0');
  }

  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      // Check if we need to wait for rate limit reset
      if (this.remaining <= 0 && Date.now() / 1000 < this.lastReset) {
        const waitTime = (this.lastReset - Date.now() / 1000) * 1000;
        await this.delay(waitTime);
      }

      const request = this.requestQueue.shift();
      if (request) {
        await request();
      }

      // Add small delay between requests to avoid overwhelming the server
      await this.delay(100);
    }

    this.isProcessing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const rateLimitHandler = new RateLimitHandler();

async function apiCall(url: string, options: RequestInit) {
  return rateLimitHandler.makeRequest(() => fetch(url, options));
}

// Example with retry logic
async function createEmployeeWithRetry(employeeData: any) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await apiCall('/api/employees', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(employeeData)
      });

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        console.log(`Rate limited, waiting ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        attempt++;
        continue;
      }

      throw new Error(`API error: ${response.status}`);
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

### Python

```python
import time
import asyncio
from typing import Optional, Dict, Any
import aiohttp
from datetime import datetime, timedelta

class RateLimitHandler:
    def __init__(self):
        self.limit = 0
        self.remaining = 0
        self.reset_time = 0
        self.request_times = []

    def update_from_headers(self, headers: Dict[str, str]):
        """Update rate limit info from response headers"""
        self.limit = int(headers.get('X-RateLimit-Limit', 0))
        self.remaining = int(headers.get('X-RateLimit-Remaining', 0))
        self.reset_time = int(headers.get('X-RateLimit-Reset', 0))

    def can_make_request(self) -> bool:
        """Check if we can make a request without hitting rate limit"""
        now = time.time()

        # Clean old requests outside the window
        window_start = now - 3600  # 1 hour window
        self.request_times = [t for t in self.request_times if t > window_start]

        # Check if we're within limits
        if len(self.request_times) >= self.limit and self.limit > 0:
            return False

        return True

    def wait_time(self) -> int:
        """Calculate how long to wait before next request"""
        if self.remaining > 0:
            return 0

        now = time.time()
        if self.reset_time > now:
            return int(self.reset_time - now)

        return 0

class AIScheduleManagerClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.token = token
        self.rate_limiter = RateLimitHandler()

    async def make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make request with rate limiting and retry logic"""
        max_retries = 3
        retry_count = 0

        while retry_count < max_retries:
            # Check rate limit before making request
            if not self.rate_limiter.can_make_request():
                wait_time = self.rate_limiter.wait_time()
                if wait_time > 0:
                    print(f"Rate limited, waiting {wait_time} seconds...")
                    await asyncio.sleep(wait_time)

            async with aiohttp.ClientSession() as session:
                headers = {
                    'Authorization': f'Bearer {self.token}',
                    'Content-Type': 'application/json',
                    **kwargs.get('headers', {})
                }

                async with session.request(
                    method,
                    f"{self.base_url}{endpoint}",
                    headers=headers,
                    **kwargs
                ) as response:
                    # Update rate limit info
                    self.rate_limiter.update_from_headers(dict(response.headers))
                    self.rate_limiter.request_times.append(time.time())

                    if response.status == 429:
                        retry_after = int(response.headers.get('Retry-After', 60))
                        print(f"Rate limit exceeded, retrying after {retry_after} seconds...")
                        await asyncio.sleep(retry_after)
                        retry_count += 1
                        continue

                    if response.status >= 400:
                        error_text = await response.text()
                        raise Exception(f"API error {response.status}: {error_text}")

                    return await response.json()

        raise Exception("Max retries exceeded due to rate limiting")

# Usage example
async def batch_create_employees(client: AIScheduleManagerClient, employees: list):
    """Create employees in batches to respect rate limits"""
    batch_size = 5  # Conservative batch size
    results = []

    for i in range(0, len(employees), batch_size):
        batch = employees[i:i + batch_size]
        batch_results = []

        # Process batch with delays
        for employee in batch:
            try:
                result = await client.make_request(
                    'POST',
                    '/api/employees',
                    json=employee
                )
                batch_results.append(result)

                # Small delay between requests in batch
                await asyncio.sleep(0.1)

            except Exception as e:
                print(f"Failed to create employee {employee.get('name', 'Unknown')}: {e}")
                batch_results.append(None)

        results.extend(batch_results)

        # Longer delay between batches
        if i + batch_size < len(employees):
            print(f"Completed batch {i//batch_size + 1}, waiting before next batch...")
            await asyncio.sleep(2)

    return results

# Example usage
async def main():
    client = AIScheduleManagerClient("http://localhost:8000", "your-jwt-token")

    employees = [
        {"name": "John Doe", "email": "john@example.com", "role": "server"},
        {"name": "Jane Smith", "email": "jane@example.com", "role": "cook"},
        # ... more employees
    ]

    results = await batch_create_employees(client, employees)
    print(f"Created {len([r for r in results if r])} employees successfully")

if __name__ == "__main__":
    asyncio.run(main())
```

### Go

```go
package main

import (
    "encoding/json"
    "fmt"
    "net/http"
    "strconv"
    "time"
)

type RateLimitInfo struct {
    Limit     int   `json:"limit"`
    Remaining int   `json:"remaining"`
    Reset     int64 `json:"reset"`
    Window    int   `json:"window"`
}

type Client struct {
    BaseURL     string
    Token       string
    HTTPClient  *http.Client
    RateLimit   RateLimitInfo
}

func NewClient(baseURL, token string) *Client {
    return &Client{
        BaseURL: baseURL,
        Token:   token,
        HTTPClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

func (c *Client) updateRateLimitInfo(resp *http.Response) {
    if limit := resp.Header.Get("X-RateLimit-Limit"); limit != "" {
        c.RateLimit.Limit, _ = strconv.Atoi(limit)
    }
    if remaining := resp.Header.Get("X-RateLimit-Remaining"); remaining != "" {
        c.RateLimit.Remaining, _ = strconv.Atoi(remaining)
    }
    if reset := resp.Header.Get("X-RateLimit-Reset"); reset != "" {
        c.RateLimit.Reset, _ = strconv.ParseInt(reset, 10, 64)
    }
    if window := resp.Header.Get("X-RateLimit-Window"); window != "" {
        c.RateLimit.Window, _ = strconv.Atoi(window)
    }
}

func (c *Client) waitForRateLimit() {
    if c.RateLimit.Remaining <= 0 && c.RateLimit.Reset > 0 {
        waitTime := time.Unix(c.RateLimit.Reset, 0).Sub(time.Now())
        if waitTime > 0 {
            fmt.Printf("Rate limited, waiting %v...\n", waitTime)
            time.Sleep(waitTime)
        }
    }
}

func (c *Client) makeRequestWithRetry(method, endpoint string, body interface{}) (*http.Response, error) {
    maxRetries := 3

    for attempt := 0; attempt < maxRetries; attempt++ {
        // Wait for rate limit if needed
        c.waitForRateLimit()

        req, err := c.buildRequest(method, endpoint, body)
        if err != nil {
            return nil, err
        }

        resp, err := c.HTTPClient.Do(req)
        if err != nil {
            if attempt == maxRetries-1 {
                return nil, err
            }
            time.Sleep(time.Duration(attempt+1) * time.Second)
            continue
        }

        // Update rate limit info
        c.updateRateLimitInfo(resp)

        if resp.StatusCode == 429 {
            retryAfter := resp.Header.Get("Retry-After")
            if retryAfter != "" {
                if seconds, err := strconv.Atoi(retryAfter); err == nil {
                    fmt.Printf("Rate limit exceeded, waiting %d seconds...\n", seconds)
                    time.Sleep(time.Duration(seconds) * time.Second)
                }
            } else {
                time.Sleep(60 * time.Second) // Default wait
            }

            resp.Body.Close()

            if attempt == maxRetries-1 {
                return nil, fmt.Errorf("rate limit exceeded after %d retries", maxRetries)
            }
            continue
        }

        return resp, nil
    }

    return nil, fmt.Errorf("max retries exceeded")
}

// Example: Batch operations with rate limiting
func (c *Client) BatchCreateEmployees(employees []map[string]interface{}) ([]map[string]interface{}, error) {
    results := make([]map[string]interface{}, 0, len(employees))
    batchSize := 5

    for i := 0; i < len(employees); i += batchSize {
        end := i + batchSize
        if end > len(employees) {
            end = len(employees)
        }

        batch := employees[i:end]
        fmt.Printf("Processing batch %d/%d (%d employees)...\n",
            i/batchSize+1, (len(employees)+batchSize-1)/batchSize, len(batch))

        for _, employee := range batch {
            resp, err := c.makeRequestWithRetry("POST", "/api/employees", employee)
            if err != nil {
                fmt.Printf("Failed to create employee: %v\n", err)
                results = append(results, nil)
                continue
            }

            var result map[string]interface{}
            json.NewDecoder(resp.Body).Decode(&result)
            resp.Body.Close()

            results = append(results, result)

            // Small delay between requests
            time.Sleep(100 * time.Millisecond)
        }

        // Longer delay between batches
        if end < len(employees) {
            fmt.Println("Waiting before next batch...")
            time.Sleep(2 * time.Second)
        }
    }

    return results, nil
}
```

## Best Practices

### Client-Side Implementation

1. **Monitor Rate Limit Headers**
   - Always check `X-RateLimit-Remaining` before making requests
   - Plan your request pattern based on limits

2. **Implement Exponential Backoff**
   ```python
   def exponential_backoff(attempt):
       return min(60, 2 ** attempt)  # Cap at 60 seconds
   ```

3. **Batch Operations**
   - Group related operations together
   - Use bulk endpoints when available
   - Spread operations over time

4. **Cache Responses**
   - Cache GET responses when possible
   - Use ETags for conditional requests
   - Implement client-side caching

### Error Handling

```typescript
class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public rateLimitInfo?: RateLimitInfo
  ) {
    super(message);
    this.name = 'APIError';
  }

  isRateLimited(): boolean {
    return this.status === 429;
  }

  getRetryAfter(): number {
    return this.rateLimitInfo?.retryAfter || 60;
  }
}

async function handleAPICall<T>(apiCall: () => Promise<T>): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    if (error instanceof APIError && error.isRateLimited()) {
      const retryAfter = error.getRetryAfter();
      console.log(`Rate limited, will retry after ${retryAfter} seconds`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return handleAPICall(apiCall); // Retry once
    }
    throw error;
  }
}
```

## Monitoring and Alerts

### Rate Limit Monitoring

Track your rate limit usage:

```typescript
class RateLimitMonitor {
  private metrics = new Map<string, number[]>();

  recordRequest(endpoint: string, remaining: number) {
    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, []);
    }

    const history = this.metrics.get(endpoint)!;
    history.push(remaining);

    // Keep only last 100 requests
    if (history.length > 100) {
      history.shift();
    }

    // Alert if consistently low
    if (history.length >= 10) {
      const avgRemaining = history.slice(-10).reduce((a, b) => a + b) / 10;
      if (avgRemaining < 10) {
        console.warn(`Low rate limit for ${endpoint}: avg ${avgRemaining} remaining`);
      }
    }
  }
}
```

## Increasing Rate Limits

For applications requiring higher limits:

1. **Contact Support**
   - Email: [support@ai-schedule-manager.com](mailto:support@ai-schedule-manager.com)
   - Include: Use case, current limits, requested limits

2. **Provide Justification**
   - Business requirements
   - Expected usage patterns
   - Integration timeline

3. **Service Accounts**
   - Higher limits for server-to-server integration
   - Dedicated API keys
   - Enhanced monitoring

## Rate Limit Bypass (Development)

For development and testing:

```bash
# Add development header (dev environment only)
X-Development-Mode: true
```

**Note**: This header only works in development environments and with specific API keys.

## Troubleshooting

### Common Issues

1. **Unexpected 429 Errors**
   - Check if you're counting all requests
   - Verify window boundaries
   - Look for concurrent requests

2. **Rate Limit Not Resetting**
   - Ensure you're reading the correct reset time
   - Check timezone handling
   - Verify server time synchronization

3. **Different Limits Than Expected**
   - Confirm user role and permissions
   - Check endpoint-specific limits
   - Verify API key configuration

### Debug Headers

Enable debug headers in development:

```http
X-Debug-RateLimit: true
```

Response includes additional debug information:
```json
{
  "debug": {
    "current_window_start": 1640995200,
    "requests_in_window": 45,
    "endpoint_specific_limit": 100,
    "user_role": "manager"
  }
}
```

---

**Need Help?**
- 📧 Support: [support@ai-schedule-manager.com](mailto:support@ai-schedule-manager.com)
- 📚 Documentation: [Rate Limiting Guide](https://docs.ai-schedule-manager.com/rate-limiting)
- 🔧 API Status: [status.ai-schedule-manager.com](https://status.ai-schedule-manager.com)