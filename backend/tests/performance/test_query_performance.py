"""
Performance tests for database query optimization

Tests query performance improvements from P2 optimization phase.
"""

import pytest
import time
from typing import List, Dict
from locust import HttpUser, task, between, events
from locust.runners import MasterRunner, WorkerRunner

# Performance benchmarks
BENCHMARKS = {
    "employee_list_100": {
        "before": 500,  # 500ms baseline
        "target": 150,  # 70% improvement
        "endpoint": "/api/employees?limit=100"
    },
    "analytics_overview": {
        "before": 300,  # 300ms baseline
        "target": 80,   # 73% improvement
        "endpoint": "/api/departments/analytics/overview"
    },
    "department_hierarchy": {
        "before": 200,  # 200ms baseline
        "target": 50,   # 75% improvement
        "endpoint": "/api/departments/hierarchy"
    },
    "employee_history_50": {
        "before": 2000,  # 2s baseline
        "target": 500,   # 75% improvement
        "endpoint": "/api/employees/1/history?limit=50"
    },
    "schedule_list_10": {
        "before": 200,  # 200ms baseline
        "target": 50,   # 75% improvement
        "endpoint": "/api/schedules?limit=10"
    }
}


class PerformanceTestUser(HttpUser):
    """
    Load testing user for performance benchmarks

    Run with:
        cd backend
        locust -f tests/performance/test_query_performance.py --host=http://localhost:8000
    """

    wait_time = between(1, 3)  # Wait 1-3 seconds between tasks

    def on_start(self):
        """Login before running tests"""
        # TODO: Implement authentication if required
        pass

    @task(5)  # Weight: 5 (most common operation)
    def get_employees(self):
        """Test employee list performance"""
        with self.client.get(
            "/api/employees?limit=100",
            name="GET /api/employees (100 records)",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                if response.elapsed.total_seconds() * 1000 > BENCHMARKS["employee_list_100"]["target"]:
                    response.failure(f"Too slow: {response.elapsed.total_seconds() * 1000:.0f}ms")
                else:
                    response.success()
            else:
                response.failure(f"Failed: {response.status_code}")

    @task(3)  # Weight: 3
    def get_analytics(self):
        """Test analytics overview performance"""
        with self.client.get(
            "/api/departments/analytics/overview",
            name="GET /api/departments/analytics",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                if response.elapsed.total_seconds() * 1000 > BENCHMARKS["analytics_overview"]["target"]:
                    response.failure(f"Too slow: {response.elapsed.total_seconds() * 1000:.0f}ms")
                else:
                    response.success()
            else:
                response.failure(f"Failed: {response.status_code}")

    @task(2)  # Weight: 2
    def get_department_hierarchy(self):
        """Test department hierarchy performance"""
        with self.client.get(
            "/api/departments/hierarchy",
            name="GET /api/departments/hierarchy",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                if response.elapsed.total_seconds() * 1000 > BENCHMARKS["department_hierarchy"]["target"]:
                    response.failure(f"Too slow: {response.elapsed.total_seconds() * 1000:.0f}ms")
                else:
                    response.success()
            else:
                response.failure(f"Failed: {response.status_code}")

    @task(2)  # Weight: 2
    def get_schedules(self):
        """Test schedule list performance"""
        with self.client.get(
            "/api/schedules?limit=10",
            name="GET /api/schedules (10 records)",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                if response.elapsed.total_seconds() * 1000 > BENCHMARKS["schedule_list_10"]["target"]:
                    response.failure(f"Too slow: {response.elapsed.total_seconds() * 1000:.0f}ms")
                else:
                    response.success()
            else:
                response.failure(f"Failed: {response.status_code}")

    @task(1)  # Weight: 1 (less common)
    def get_employee_history(self):
        """Test employee history performance"""
        with self.client.get(
            "/api/employees/1/history?limit=50",
            name="GET /api/employees/{id}/history",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                if response.elapsed.total_seconds() * 1000 > BENCHMARKS["employee_history_50"]["target"]:
                    response.failure(f"Too slow: {response.elapsed.total_seconds() * 1000:.0f}ms")
                else:
                    response.success()
            elif response.status_code == 404:
                # Employee might not exist, that's okay
                response.success()
            else:
                response.failure(f"Failed: {response.status_code}")


# Performance monitoring events
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Log test start"""
    print("\n" + "="*80)
    print("PERFORMANCE TEST STARTED")
    print("="*80)
    print("\nPerformance Targets:")
    for name, bench in BENCHMARKS.items():
        improvement = ((bench["before"] - bench["target"]) / bench["before"]) * 100
        print(f"  {name}: {bench['before']}ms → {bench['target']}ms ({improvement:.0f}% faster)")
    print("\n" + "="*80 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Generate performance report"""
    print("\n" + "="*80)
    print("PERFORMANCE TEST COMPLETED")
    print("="*80)

    stats = environment.stats

    print("\nPerformance Results:")
    print(f"{'Endpoint':<40} {'Median':<10} {'95th %ile':<10} {'Target':<10} {'Status'}")
    print("-" * 80)

    for name, bench in BENCHMARKS.items():
        stat = stats.get(bench.get("name", bench["endpoint"]), None)
        if stat:
            median = stat.median_response_time
            p95 = stat.get_response_time_percentile(0.95)
            target = bench["target"]

            status = "✅ PASS" if median <= target else "❌ FAIL"

            print(f"{name:<40} {median:<10.0f} {p95:<10.0f} {target:<10} {status}")
        else:
            print(f"{name:<40} {'N/A':<10} {'N/A':<10} {bench['target']:<10} {'⚠️  SKIP'}")

    print("\nOverall Statistics:")
    print(f"  Total Requests: {stats.total.num_requests}")
    print(f"  Total Failures: {stats.total.num_failures}")
    print(f"  Failure Rate: {stats.total.fail_ratio * 100:.2f}%")
    print(f"  Median Response Time: {stats.total.median_response_time:.0f}ms")
    print(f"  95th Percentile: {stats.total.get_response_time_percentile(0.95):.0f}ms")
    print(f"  Requests/sec: {stats.total.total_rps:.2f}")

    print("\n" + "="*80 + "\n")


# Pytest integration for CI/CD
@pytest.mark.performance
class TestQueryPerformance:
    """
    Pytest-based performance tests

    Run with:
        pytest backend/tests/performance/test_query_performance.py -v -m performance
    """

    @pytest.mark.asyncio
    async def test_employee_list_performance(self, async_client):
        """Test employee list query performance"""
        # Warm-up request
        await async_client.get("/api/employees?limit=10")

        # Measure performance
        start = time.time()
        response = await async_client.get("/api/employees?limit=100")
        duration_ms = (time.time() - start) * 1000

        assert response.status_code == 200
        assert duration_ms < BENCHMARKS["employee_list_100"]["target"], \
            f"Employee list too slow: {duration_ms:.0f}ms > {BENCHMARKS['employee_list_100']['target']}ms"

    @pytest.mark.asyncio
    async def test_analytics_performance(self, async_client):
        """Test analytics query performance"""
        start = time.time()
        response = await async_client.get("/api/departments/analytics/overview")
        duration_ms = (time.time() - start) * 1000

        assert response.status_code == 200
        assert duration_ms < BENCHMARKS["analytics_overview"]["target"], \
            f"Analytics too slow: {duration_ms:.0f}ms > {BENCHMARKS['analytics_overview']['target']}ms"

    @pytest.mark.asyncio
    async def test_hierarchy_performance(self, async_client):
        """Test department hierarchy performance"""
        start = time.time()
        response = await async_client.get("/api/departments/hierarchy")
        duration_ms = (time.time() - start) * 1000

        assert response.status_code == 200
        assert duration_ms < BENCHMARKS["department_hierarchy"]["target"], \
            f"Hierarchy too slow: {duration_ms:.0f}ms > {BENCHMARKS['department_hierarchy']['target']}ms"

    @pytest.mark.asyncio
    async def test_schedule_list_performance(self, async_client):
        """Test schedule list performance"""
        start = time.time()
        response = await async_client.get("/api/schedules?limit=10")
        duration_ms = (time.time() - start) * 1000

        assert response.status_code in [200, 404]  # May not have schedules
        if response.status_code == 200:
            assert duration_ms < BENCHMARKS["schedule_list_10"]["target"], \
                f"Schedule list too slow: {duration_ms:.0f}ms > {BENCHMARKS['schedule_list_10']['target']}ms"


if __name__ == "__main__":
    # Run locust from command line
    import os
    os.system("locust -f test_query_performance.py --host=http://localhost:8000 --headless --users 10 --spawn-rate 2 --run-time 60s")
