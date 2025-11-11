"""
Load tests for WebSocket functionality
Tests concurrent connections and message throughput
"""

import asyncio
import json
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List
from unittest.mock import AsyncMock, Mock

import pytest
import websockets
from websockets.exceptions import ConnectionClosed


class WebSocketLoadTester:
    """Load testing utility for WebSocket connections"""

    def __init__(self, base_url: str = "ws://localhost:8000"):
        self.base_url = base_url
        self.connections: List[websockets.WebSocketServerProtocol] = []
        self.stats = {
            "connections_created": 0,
            "connections_failed": 0,
            "messages_sent": 0,
            "messages_received": 0,
            "connection_times": [],
            "message_latencies": [],
            "errors": [],
        }

    async def create_connection(self, token: str, connection_id: str) -> websockets.WebSocketServerProtocol:
        """Create a single WebSocket connection"""
        start_time = time.time()

        try:
            ws_url = f"{self.base_url}/ws?token={token}"
            websocket = await websockets.connect(ws_url)

            connection_time = time.time() - start_time
            self.stats["connection_times"].append(connection_time)
            self.stats["connections_created"] += 1

            self.connections.append(websocket)
            return websocket

        except Exception as e:
            self.stats["connections_failed"] += 1
            self.stats["errors"].append(f"Connection {connection_id}: {str(e)}")
            raise

    async def send_message(self, websocket: websockets.WebSocketServerProtocol, message: Dict[str, Any]) -> float:
        """Send a message and measure latency"""
        start_time = time.time()

        try:
            await websocket.send(json.dumps(message))
            self.stats["messages_sent"] += 1

            # Wait for response (assuming echo or acknowledgment)
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            latency = time.time() - start_time

            self.stats["messages_received"] += 1
            self.stats["message_latencies"].append(latency)

            return latency

        except asyncio.TimeoutError:
            self.stats["errors"].append("Message timeout")
            return -1
        except Exception as e:
            self.stats["errors"].append(f"Message error: {str(e)}")
            return -1

    async def close_connection(self, websocket: websockets.WebSocketServerProtocol):
        """Close a WebSocket connection"""
        try:
            await websocket.close()
        except Exception as e:
            self.stats["errors"].append(f"Close error: {str(e)}")

    async def simulate_user_session(self, user_id: int, token: str, duration: int = 30):
        """Simulate a complete user session"""
        connection_id = f"load_test_user_{user_id}"

        try:
            # Connect
            websocket = await self.create_connection(token, connection_id)

            # Simulate user activity
            start_time = time.time()
            message_count = 0

            while time.time() - start_time < duration:
                # Send various message types
                messages = [
                    {"type": "ping"},
                    {"type": "join_room", "data": {"room": "schedules"}},
                    {"type": "user_typing", "data": {"location": f"schedule_{user_id}"}},
                    {"type": "user_editing", "data": {"resource_type": "shift", "resource_id": user_id}},
                ]

                for message in messages:
                    await self.send_message(websocket, message)
                    message_count += 1

                    # Random delay between messages
                    await asyncio.sleep(0.1 + (user_id % 10) * 0.01)

                # Longer pause between bursts
                await asyncio.sleep(1)

            # Disconnect
            await self.close_connection(websocket)

        except Exception as e:
            self.stats["errors"].append(f"User {user_id} session error: {str(e)}")

    def get_statistics(self) -> Dict[str, Any]:
        """Calculate and return performance statistics"""
        stats = self.stats.copy()

        # Connection statistics
        if stats["connection_times"]:
            stats["avg_connection_time"] = statistics.mean(stats["connection_times"])
            stats["p95_connection_time"] = statistics.quantiles(stats["connection_times"], n=20)[18]  # 95th percentile

        # Message latency statistics
        if stats["message_latencies"]:
            valid_latencies = [l for l in stats["message_latencies"] if l > 0]
            if valid_latencies:
                stats["avg_message_latency"] = statistics.mean(valid_latencies)
                stats["p95_message_latency"] = statistics.quantiles(valid_latencies, n=20)[18]
                stats["min_message_latency"] = min(valid_latencies)
                stats["max_message_latency"] = max(valid_latencies)

        # Throughput
        stats["connection_success_rate"] = (
            stats["connections_created"] / (stats["connections_created"] + stats["connections_failed"])
            if (stats["connections_created"] + stats["connections_failed"]) > 0
            else 0
        )

        stats["message_success_rate"] = (
            stats["messages_received"] / stats["messages_sent"] if stats["messages_sent"] > 0 else 0
        )

        return stats


@pytest.mark.asyncio
class TestWebSocketLoad:
    """Load test cases for WebSocket functionality"""

    @pytest.fixture
    def load_tester(self):
        """Create a load tester instance"""
        return WebSocketLoadTester()

    @pytest.fixture
    def mock_token(self):
        """Generate a mock JWT token"""
        return "mock_jwt_token_for_load_testing"

    async def test_concurrent_connections(self, load_tester, mock_token):
        """Test multiple concurrent connections"""
        connection_count = 50
        tasks = []

        for i in range(connection_count):
            task = asyncio.create_task(load_tester.create_connection(mock_token, f"load_test_{i}"))
            tasks.append(task)

        # Wait for all connections with timeout
        try:
            await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=30)
        except asyncio.TimeoutError:
            pytest.fail("Connection timeout during load test")

        stats = load_tester.get_statistics()

        # Assertions
        assert stats["connections_created"] >= connection_count * 0.8  # Allow 20% failure rate
        assert stats["connection_success_rate"] >= 0.8
        if stats.get("avg_connection_time"):
            assert stats["avg_connection_time"] < 5.0  # Should connect within 5 seconds

        # Cleanup
        cleanup_tasks = [asyncio.create_task(load_tester.close_connection(ws)) for ws in load_tester.connections]
        await asyncio.gather(*cleanup_tasks, return_exceptions=True)

    async def test_message_throughput(self, load_tester, mock_token):
        """Test message sending throughput"""
        connection_count = 10
        messages_per_connection = 100

        # Create connections
        connections = []
        for i in range(connection_count):
            try:
                ws = await load_tester.create_connection(mock_token, f"throughput_test_{i}")
                connections.append(ws)
            except Exception:
                pass  # Some connections may fail

        assert len(connections) > 0, "No connections established"

        # Send messages concurrently
        tasks = []
        for i, ws in enumerate(connections):
            for j in range(messages_per_connection):
                message = {"type": "test_message", "data": {"connection": i, "message": j, "timestamp": time.time()}}
                task = asyncio.create_task(load_tester.send_message(ws, message))
                tasks.append(task)

        # Execute all message sends
        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.time() - start_time

        stats = load_tester.get_statistics()

        # Throughput calculations
        successful_messages = sum(1 for r in results if isinstance(r, float) and r > 0)
        throughput = successful_messages / total_time if total_time > 0 else 0

        # Assertions
        assert stats["message_success_rate"] >= 0.7  # Allow 30% message loss
        assert throughput > 10  # Should handle at least 10 messages per second
        if stats.get("avg_message_latency"):
            assert stats["avg_message_latency"] < 1.0  # Average latency under 1 second

        # Cleanup
        cleanup_tasks = [asyncio.create_task(load_tester.close_connection(ws)) for ws in connections]
        await asyncio.gather(*cleanup_tasks, return_exceptions=True)

    async def test_user_session_simulation(self, load_tester, mock_token):
        """Test realistic user sessions"""
        user_count = 20
        session_duration = 10  # seconds

        # Run user sessions concurrently
        tasks = [
            asyncio.create_task(load_tester.simulate_user_session(i, mock_token, session_duration)) for i in range(user_count)
        ]

        start_time = time.time()
        await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.time() - start_time

        stats = load_tester.get_statistics()

        # Assertions
        assert total_time <= session_duration + 10  # Allow some overhead
        assert stats["connections_created"] >= user_count * 0.8
        assert len(stats["errors"]) <= user_count * 0.3  # Max 30% error rate

        print(f"\nLoad Test Results:")
        print(f"Users: {user_count}")
        print(f"Duration: {total_time:.2f}s")
        print(f"Connections: {stats['connections_created']}")
        print(f"Messages: {stats['messages_sent']} sent, {stats['messages_received']} received")
        print(f"Success Rate: {stats['connection_success_rate']:.2%}")

    async def test_connection_stability(self, load_tester, mock_token):
        """Test connection stability over time"""
        connection_count = 10
        test_duration = 30  # seconds

        # Create initial connections
        connections = []
        for i in range(connection_count):
            try:
                ws = await load_tester.create_connection(mock_token, f"stability_test_{i}")
                connections.append(ws)
            except Exception:
                pass

        initial_connections = len(connections)
        assert initial_connections > 0

        # Send periodic messages
        start_time = time.time()
        message_interval = 2  # seconds

        while time.time() - start_time < test_duration:
            # Send ping to all connections
            ping_tasks = []
            for i, ws in enumerate(connections[:]):  # Copy list to avoid modification during iteration
                try:
                    task = asyncio.create_task(load_tester.send_message(ws, {"type": "ping"}))
                    ping_tasks.append((i, task))
                except Exception:
                    connections.remove(ws)

            # Wait for responses
            if ping_tasks:
                results = await asyncio.gather(*[task for _, task in ping_tasks], return_exceptions=True)

                # Remove failed connections
                failed_indices = [
                    i for (i, _), result in zip(ping_tasks, results) if isinstance(result, Exception) or result < 0
                ]

                for i in sorted(failed_indices, reverse=True):
                    if i < len(connections):
                        connections.pop(i)

            await asyncio.sleep(message_interval)

        final_connections = len(connections)
        stability_rate = final_connections / initial_connections if initial_connections > 0 else 0

        # Cleanup
        cleanup_tasks = [asyncio.create_task(load_tester.close_connection(ws)) for ws in connections]
        await asyncio.gather(*cleanup_tasks, return_exceptions=True)

        # Assertions
        assert stability_rate >= 0.7  # At least 70% of connections should remain stable

        print(f"\nStability Test Results:")
        print(f"Initial connections: {initial_connections}")
        print(f"Final connections: {final_connections}")
        print(f"Stability rate: {stability_rate:.2%}")


@pytest.mark.asyncio
async def test_memory_usage_under_load():
    """Test memory usage during high load"""
    import os

    import psutil

    process = psutil.Process(os.getpid())
    initial_memory = process.memory_info().rss

    load_tester = WebSocketLoadTester()
    mock_token = "mock_token"

    # Create many connections
    connection_count = 100
    tasks = []

    for i in range(connection_count):
        task = asyncio.create_task(load_tester.create_connection(mock_token, f"memory_test_{i}"))
        tasks.append(task)

    # Monitor memory during connection creation
    try:
        await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=60)
    except asyncio.TimeoutError:
        pass

    peak_memory = process.memory_info().rss
    memory_increase = peak_memory - initial_memory

    # Cleanup
    cleanup_tasks = [asyncio.create_task(load_tester.close_connection(ws)) for ws in load_tester.connections]
    await asyncio.gather(*cleanup_tasks, return_exceptions=True)

    final_memory = process.memory_info().rss

    # Assertions
    memory_mb = memory_increase / (1024 * 1024)
    memory_per_connection = memory_increase / max(1, load_tester.stats["connections_created"])

    print(f"\nMemory Usage Test:")
    print(f"Memory increase: {memory_mb:.2f} MB")
    print(f"Memory per connection: {memory_per_connection / 1024:.2f} KB")
    print(f"Connections created: {load_tester.stats['connections_created']}")

    # Should not use excessive memory
    assert memory_mb < 500  # Less than 500MB increase
    assert memory_per_connection < 1024 * 1024  # Less than 1MB per connection


if __name__ == "__main__":
    # Run load tests directly
    async def run_load_tests():
        load_tester = WebSocketLoadTester()

        print("Starting WebSocket Load Tests...")

        # Test concurrent connections
        print("\n1. Testing concurrent connections...")
        await load_tester.test_concurrent_connections("mock_token")

        # Test message throughput
        print("\n2. Testing message throughput...")
        await load_tester.test_message_throughput("mock_token")

        # Test user sessions
        print("\n3. Testing user sessions...")
        await load_tester.test_user_session_simulation("mock_token")

        # Print final statistics
        stats = load_tester.get_statistics()
        print(f"\nFinal Statistics:")
        for key, value in stats.items():
            if isinstance(value, float):
                print(f"  {key}: {value:.4f}")
            elif isinstance(value, list):
                print(f"  {key}: {len(value)} items")
            else:
                print(f"  {key}: {value}")

    asyncio.run(run_load_tests())
