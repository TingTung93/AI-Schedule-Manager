"""
Backend Health Monitoring
Tracks database sessions, event loop, and memory to identify performance issues.
"""

import asyncio
import logging
import os
import tracemalloc
from datetime import datetime
from typing import Optional

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

logger = logging.getLogger(__name__)


class HealthMonitor:
    """Monitor backend health metrics"""

    def __init__(self, engine, check_interval: int = 60):
        self.engine = engine
        self.check_interval = check_interval
        self.monitoring_tasks = []
        self.process = psutil.Process(os.getpid()) if PSUTIL_AVAILABLE else None

        # Start memory tracking
        tracemalloc.start()

    async def start(self):
        """Start all monitoring tasks"""
        logger.info("Starting health monitoring...")

        # Start monitoring tasks
        self.monitoring_tasks = [
            asyncio.create_task(self._monitor_db_pool()),
            asyncio.create_task(self._monitor_event_loop()),
            asyncio.create_task(self._monitor_memory()),
        ]

        logger.info(f"Health monitoring started (interval: {self.check_interval}s)")

    async def stop(self):
        """Stop all monitoring tasks"""
        logger.info("Stopping health monitoring...")
        for task in self.monitoring_tasks:
            task.cancel()

        # Wait for all tasks to finish
        await asyncio.gather(*self.monitoring_tasks, return_exceptions=True)
        logger.info("Health monitoring stopped")

    async def _monitor_db_pool(self):
        """Monitor database connection pool"""
        while True:
            try:
                pool = self.engine.pool

                # Get pool statistics
                size = pool.size()
                checked_out = pool.checkedout()
                overflow = pool.overflow()
                checked_in = size - checked_out

                # Calculate pool utilization
                total_capacity = size + pool._max_overflow
                utilization = (checked_out / total_capacity * 100) if total_capacity > 0 else 0

                logger.info(
                    f"[DB Pool] Size: {size}, In Use: {checked_out}, Available: {checked_in}, "
                    f"Overflow: {overflow}, Utilization: {utilization:.1f}%"
                )

                # Warning if pool is highly utilized
                if utilization > 80:
                    logger.warning(
                        f"High database pool utilization: {utilization:.1f}% "
                        f"({checked_out}/{total_capacity} connections in use)"
                    )

                # Critical if pool is exhausted
                if checked_out >= total_capacity:
                    logger.error(
                        f"Database pool EXHAUSTED! All {total_capacity} connections in use. "
                        "New requests will block until a connection is released."
                    )

            except Exception as e:
                logger.error(f"Error monitoring DB pool: {e}")

            await asyncio.sleep(self.check_interval)

    async def _monitor_event_loop(self):
        """Monitor async event loop health"""
        while True:
            try:
                loop = asyncio.get_event_loop()

                # Count pending tasks
                all_tasks = [t for t in asyncio.all_tasks(loop) if not t.done()]
                pending_count = len(all_tasks)

                logger.info(f"[Event Loop] Pending tasks: {pending_count}")

                # Warning if too many pending tasks
                if pending_count > 100:
                    logger.warning(
                        f"High number of pending async tasks: {pending_count}. "
                        "This may indicate a resource leak or slow operations."
                    )

                    # Log task details for debugging
                    task_types = {}
                    for task in all_tasks[:10]:  # Sample first 10 tasks
                        coro_name = task.get_coro().__qualname__ if hasattr(task.get_coro(), '__qualname__') else str(task.get_coro())
                        task_types[coro_name] = task_types.get(coro_name, 0) + 1

                    logger.info(f"Task breakdown (sample): {task_types}")

                # Critical if event loop appears blocked
                if pending_count > 500:
                    logger.error(
                        f"Event loop may be BLOCKED! {pending_count} pending tasks. "
                        "Application may become unresponsive."
                    )

            except Exception as e:
                logger.error(f"Error monitoring event loop: {e}")

            await asyncio.sleep(self.check_interval)

    async def _monitor_memory(self):
        """Monitor memory usage"""
        while True:
            try:
                # Get process memory info if psutil is available
                if self.process:
                    mem_info = self.process.memory_info()
                    rss_mb = mem_info.rss / 1024 / 1024
                    vms_mb = mem_info.vms / 1024 / 1024

                    logger.info(
                        f"[Memory] RSS: {rss_mb:.1f} MB, VMS: {vms_mb:.1f} MB"
                    )

                    # Warning if memory usage is high
                    if rss_mb > 500:
                        logger.warning(f"High memory usage: {rss_mb:.1f} MB RSS")

                    # Critical if memory usage is very high
                    if rss_mb > 1000:
                        logger.error(f"CRITICAL memory usage: {rss_mb:.1f} MB RSS. Memory leak possible!")

                # Get Python object memory allocation
                current, peak = tracemalloc.get_traced_memory()
                current_mb = current / 1024 / 1024
                peak_mb = peak / 1024 / 1024

                logger.info(
                    f"[Python Memory] Current: {current_mb:.1f} MB, Peak: {peak_mb:.1f} MB"
                )

                # Get top memory allocations
                snapshot = tracemalloc.take_snapshot()
                top_stats = snapshot.statistics('lineno')

                # Log top 3 memory allocators
                logger.debug("[Top Memory Allocators]")
                for stat in top_stats[:3]:
                    logger.debug(f"  {stat}")

            except Exception as e:
                logger.error(f"Error monitoring memory: {e}")

            await asyncio.sleep(self.check_interval)

    def get_health_status(self) -> dict:
        """Get current health status snapshot"""
        status = {
            "timestamp": datetime.utcnow().isoformat(),
            "db_pool": {},
            "event_loop": {},
            "memory": {},
        }

        try:
            # Database pool status
            pool = self.engine.pool
            status["db_pool"] = {
                "size": pool.size(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow(),
                "max_overflow": pool._max_overflow,
            }

            # Event loop status
            loop = asyncio.get_event_loop()
            all_tasks = [t for t in asyncio.all_tasks(loop) if not t.done()]
            status["event_loop"] = {
                "pending_tasks": len(all_tasks),
            }

            # Memory status
            if self.process:
                mem_info = self.process.memory_info()
                status["memory"] = {
                    "rss_mb": mem_info.rss / 1024 / 1024,
                    "vms_mb": mem_info.vms / 1024 / 1024,
                }

            current, peak = tracemalloc.get_traced_memory()
            status["memory"]["python_current_mb"] = current / 1024 / 1024
            status["memory"]["python_peak_mb"] = peak / 1024 / 1024

        except Exception as e:
            logger.error(f"Error getting health status: {e}")
            status["error"] = str(e)

        return status


# Global health monitor instance
_health_monitor: Optional[HealthMonitor] = None


def get_health_monitor() -> Optional[HealthMonitor]:
    """Get the global health monitor instance"""
    return _health_monitor


def set_health_monitor(monitor: HealthMonitor):
    """Set the global health monitor instance"""
    global _health_monitor
    _health_monitor = monitor
