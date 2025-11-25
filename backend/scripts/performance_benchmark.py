#!/usr/bin/env python3
"""
Performance Benchmark Script
Tests API endpoint performance and database query efficiency
"""

import asyncio
import time
import statistics
from typing import List, Dict, Any
import httpx
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


class PerformanceBenchmark:
    """Performance benchmarking tool for API endpoints"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results: Dict[str, Any] = {}

    async def get_auth_token(self) -> str:
        """Get authentication token for API requests"""
        async with httpx.AsyncClient(base_url=self.base_url) as client:
            # Login as admin
            response = await client.post(
                "/api/auth/login",
                data={
                    "username": "admin",
                    "password": "admin123"
                }
            )

            if response.status_code == 200:
                data = response.json()
                return data.get("access_token")
            else:
                raise Exception(f"Failed to authenticate: {response.status_code}")

    async def benchmark_endpoint(
        self,
        method: str,
        endpoint: str,
        n_requests: int = 100,
        headers: Dict = None,
        json_data: Dict = None,
        params: Dict = None
    ) -> Dict[str, Any]:
        """
        Benchmark a single endpoint

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            n_requests: Number of requests to make
            headers: Request headers
            json_data: JSON payload for POST/PUT
            params: Query parameters

        Returns:
            Dictionary with benchmark results
        """
        response_times: List[float] = []
        success_count = 0
        error_count = 0
        status_codes: Dict[int, int] = {}

        async with httpx.AsyncClient(
            base_url=self.base_url,
            timeout=30.0
        ) as client:
            start_time = time.time()

            for i in range(n_requests):
                request_start = time.time()

                try:
                    if method.upper() == "GET":
                        response = await client.get(
                            endpoint,
                            headers=headers,
                            params=params
                        )
                    elif method.upper() == "POST":
                        response = await client.post(
                            endpoint,
                            headers=headers,
                            json=json_data,
                            params=params
                        )
                    elif method.upper() == "PUT":
                        response = await client.put(
                            endpoint,
                            headers=headers,
                            json=json_data
                        )
                    elif method.upper() == "DELETE":
                        response = await client.delete(
                            endpoint,
                            headers=headers
                        )

                    request_time = (time.time() - request_start) * 1000  # Convert to ms
                    response_times.append(request_time)

                    # Track status codes
                    status_code = response.status_code
                    status_codes[status_code] = status_codes.get(status_code, 0) + 1

                    if 200 <= status_code < 300:
                        success_count += 1
                    else:
                        error_count += 1

                except Exception as e:
                    error_count += 1
                    print(f"Request {i+1} failed: {e}")

            total_time = time.time() - start_time

        # Calculate statistics
        if response_times:
            return {
                "endpoint": endpoint,
                "method": method,
                "total_requests": n_requests,
                "successful_requests": success_count,
                "failed_requests": error_count,
                "total_time_seconds": round(total_time, 2),
                "avg_response_time_ms": round(statistics.mean(response_times), 2),
                "min_response_time_ms": round(min(response_times), 2),
                "max_response_time_ms": round(max(response_times), 2),
                "median_response_time_ms": round(statistics.median(response_times), 2),
                "p95_response_time_ms": round(statistics.quantiles(response_times, n=20)[18], 2),
                "p99_response_time_ms": round(statistics.quantiles(response_times, n=100)[98], 2),
                "throughput_rps": round(n_requests / total_time, 2),
                "status_codes": status_codes
            }
        else:
            return {
                "endpoint": endpoint,
                "error": "No successful requests"
            }

    async def benchmark_concurrent_requests(
        self,
        method: str,
        endpoint: str,
        concurrency: int = 10,
        total_requests: int = 100,
        headers: Dict = None
    ) -> Dict[str, Any]:
        """
        Benchmark endpoint with concurrent requests

        Args:
            method: HTTP method
            endpoint: API endpoint
            concurrency: Number of concurrent requests
            total_requests: Total number of requests
            headers: Request headers

        Returns:
            Benchmark results
        """
        response_times: List[float] = []
        success_count = 0
        error_count = 0

        async with httpx.AsyncClient(
            base_url=self.base_url,
            timeout=30.0
        ) as client:
            start_time = time.time()

            # Create batches of concurrent requests
            for batch_start in range(0, total_requests, concurrency):
                batch_size = min(concurrency, total_requests - batch_start)
                tasks = []

                for _ in range(batch_size):
                    request_start = time.time()

                    async def make_request():
                        try:
                            if method.upper() == "GET":
                                response = await client.get(endpoint, headers=headers)
                            request_time = (time.time() - request_start) * 1000
                            return {"success": True, "time": request_time, "status": response.status_code}
                        except Exception as e:
                            return {"success": False, "error": str(e)}

                    tasks.append(make_request())

                # Execute batch concurrently
                results = await asyncio.gather(*tasks)

                for result in results:
                    if result.get("success"):
                        success_count += 1
                        response_times.append(result["time"])
                    else:
                        error_count += 1

            total_time = time.time() - start_time

        if response_times:
            return {
                "endpoint": endpoint,
                "concurrency": concurrency,
                "total_requests": total_requests,
                "successful_requests": success_count,
                "failed_requests": error_count,
                "total_time_seconds": round(total_time, 2),
                "avg_response_time_ms": round(statistics.mean(response_times), 2),
                "p95_response_time_ms": round(statistics.quantiles(response_times, n=20)[18], 2),
                "throughput_rps": round(total_requests / total_time, 2)
            }
        else:
            return {"endpoint": endpoint, "error": "No successful requests"}

    def print_results(self, results: Dict[str, Any]):
        """Print benchmark results in readable format"""
        print("\n" + "="*80)
        print(f"Benchmark: {results.get('method', 'N/A')} {results['endpoint']}")
        print("="*80)

        if "error" in results:
            print(f"❌ ERROR: {results['error']}")
            return

        print(f"Total Requests:       {results['total_requests']}")
        print(f"Successful:           {results['successful_requests']} ({results['successful_requests']/results['total_requests']*100:.1f}%)")
        print(f"Failed:               {results['failed_requests']}")
        print(f"\nTiming:")
        print(f"  Total Time:         {results['total_time_seconds']}s")
        print(f"  Average Response:   {results['avg_response_time_ms']}ms")

        if 'min_response_time_ms' in results:
            print(f"  Min Response:       {results['min_response_time_ms']}ms")
            print(f"  Max Response:       {results['max_response_time_ms']}ms")
            print(f"  Median Response:    {results['median_response_time_ms']}ms")

        print(f"  P95 Response:       {results['p95_response_time_ms']}ms")

        if 'p99_response_time_ms' in results:
            print(f"  P99 Response:       {results['p99_response_time_ms']}ms")

        print(f"\nThroughput:           {results['throughput_rps']} requests/second")

        if 'status_codes' in results:
            print(f"\nStatus Codes:")
            for code, count in sorted(results['status_codes'].items()):
                print(f"  {code}: {count}")

        # Performance assessment
        avg_time = results['avg_response_time_ms']
        p95_time = results['p95_response_time_ms']

        print(f"\nPerformance Assessment:")
        if avg_time < 100:
            print(f"  Average: ✅ EXCELLENT ({avg_time}ms < 100ms target)")
        elif avg_time < 200:
            print(f"  Average: ⚠️  ACCEPTABLE ({avg_time}ms < 200ms)")
        else:
            print(f"  Average: ❌ NEEDS IMPROVEMENT ({avg_time}ms > 200ms)")

        if p95_time < 150:
            print(f"  P95: ✅ EXCELLENT ({p95_time}ms < 150ms target)")
        elif p95_time < 300:
            print(f"  P95: ⚠️  ACCEPTABLE ({p95_time}ms < 300ms)")
        else:
            print(f"  P95: ❌ NEEDS IMPROVEMENT ({p95_time}ms > 300ms)")

    async def run_full_benchmark(self):
        """Run complete benchmark suite"""
        print("\n" + "="*80)
        print("EMPLOYEE MANAGEMENT SYSTEM - PERFORMANCE BENCHMARK")
        print("="*80)

        # Get authentication token
        print("\n🔐 Authenticating...")
        try:
            token = await self.get_auth_token()
            headers = {"Authorization": f"Bearer {token}"}
            print("✅ Authentication successful")
        except Exception as e:
            print(f"❌ Authentication failed: {e}")
            print("⚠️  Make sure the backend server is running and admin user exists")
            return

        # 1. Employee List (no filters)
        print("\n📊 Benchmarking: Employee List (100 requests)")
        result = await self.benchmark_endpoint(
            "GET",
            "/api/employees",
            n_requests=100,
            headers=headers
        )
        self.print_results(result)
        self.results['employee_list'] = result

        # 2. Employee List with Search
        print("\n📊 Benchmarking: Employee Search (100 requests)")
        result = await self.benchmark_endpoint(
            "GET",
            "/api/employees",
            n_requests=100,
            headers=headers,
            params={"search": "john"}
        )
        self.print_results(result)
        self.results['employee_search'] = result

        # 3. Employee List with Filters
        print("\n📊 Benchmarking: Employee Filter (100 requests)")
        result = await self.benchmark_endpoint(
            "GET",
            "/api/employees",
            n_requests=100,
            headers=headers,
            params={"department": "Engineering"}
        )
        self.print_results(result)
        self.results['employee_filter'] = result

        # 4. Single Employee Retrieval
        print("\n📊 Benchmarking: Get Single Employee (100 requests)")
        result = await self.benchmark_endpoint(
            "GET",
            "/api/employees/1",
            n_requests=100,
            headers=headers
        )
        self.print_results(result)
        self.results['employee_get'] = result

        # 5. Concurrent Requests Test
        print("\n📊 Benchmarking: Concurrent Requests (10 concurrent, 100 total)")
        result = await self.benchmark_concurrent_requests(
            "GET",
            "/api/employees",
            concurrency=10,
            total_requests=100,
            headers=headers
        )
        self.print_results(result)
        self.results['concurrent_requests'] = result

        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print overall performance summary"""
        print("\n" + "="*80)
        print("PERFORMANCE SUMMARY")
        print("="*80)

        targets = {
            "employee_list": 100,
            "employee_search": 150,
            "employee_filter": 150,
            "employee_get": 50,
            "concurrent_requests": 200
        }

        all_pass = True

        for test_name, target_ms in targets.items():
            if test_name in self.results:
                result = self.results[test_name]

                if "error" not in result:
                    avg_time = result['avg_response_time_ms']
                    status = "✅ PASS" if avg_time <= target_ms else "❌ FAIL"

                    if avg_time > target_ms:
                        all_pass = False

                    print(f"{test_name:25} {avg_time:7.2f}ms (target: {target_ms}ms) {status}")

        print("="*80)

        if all_pass:
            print("🎉 ALL PERFORMANCE TARGETS MET!")
        else:
            print("⚠️  SOME PERFORMANCE TARGETS NOT MET - OPTIMIZATION NEEDED")

        print("\n📋 Performance Targets:")
        print("  - Employee list (100 records): <100ms")
        print("  - Search query: <150ms")
        print("  - Filter query: <150ms")
        print("  - Get single employee: <50ms")
        print("  - Concurrent requests: <200ms average")
        print("  - Database queries: ≤3 for list operations")


async def main():
    """Main entry point"""
    benchmark = PerformanceBenchmark()

    try:
        await benchmark.run_full_benchmark()
    except KeyboardInterrupt:
        print("\n\n⚠️  Benchmark interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Benchmark failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
