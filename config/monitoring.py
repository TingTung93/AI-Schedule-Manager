import time
import psutil
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import asyncio
import json
from dataclasses import dataclass, asdict
from pathlib import Path

@dataclass
class PerformanceMetrics:
    timestamp: datetime
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    disk_usage_percent: float
    network_sent_mb: float
    network_recv_mb: float
    active_connections: int
    response_time_avg: float
    error_rate: float
    cache_hit_rate: float

class PerformanceMonitor:
    def __init__(self, metrics_file: str = "metrics.json"):
        self.metrics_file = Path(metrics_file)
        self.metrics_history: List[PerformanceMetrics] = []
        self.response_times: List[float] = []
        self.error_count = 0
        self.total_requests = 0
        self.cache_hits = 0
        self.cache_misses = 0
        self.start_time = time.time()
        
        # Network baseline
        net_io = psutil.net_io_counters()
        self.initial_bytes_sent = net_io.bytes_sent
        self.initial_bytes_recv = net_io.bytes_recv
    
    async def collect_system_metrics(self) -> PerformanceMetrics:
        """Collect current system performance metrics"""
        # CPU and Memory
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        
        # Disk usage
        disk = psutil.disk_usage('/')
        
        # Network
        net_io = psutil.net_io_counters()
        network_sent_mb = (net_io.bytes_sent - self.initial_bytes_sent) / 1024 / 1024
        network_recv_mb = (net_io.bytes_recv - self.initial_bytes_recv) / 1024 / 1024
        
        # Active connections
        connections = len(psutil.net_connections())
        
        # Application metrics
        avg_response_time = sum(self.response_times) / len(self.response_times) if self.response_times else 0
        error_rate = (self.error_count / self.total_requests * 100) if self.total_requests > 0 else 0
        cache_hit_rate = (self.cache_hits / (self.cache_hits + self.cache_misses) * 100) if (self.cache_hits + self.cache_misses) > 0 else 0
        
        return PerformanceMetrics(
            timestamp=datetime.now(),
            cpu_percent=cpu_percent,
            memory_percent=memory.percent,
            memory_used_mb=memory.used / 1024 / 1024,
            disk_usage_percent=disk.percent,
            network_sent_mb=network_sent_mb,
            network_recv_mb=network_recv_mb,
            active_connections=connections,
            response_time_avg=avg_response_time,
            error_rate=error_rate,
            cache_hit_rate=cache_hit_rate
        )
    
    def record_request(self, response_time: float, is_error: bool = False):
        """Record a request for metrics"""
        self.response_times.append(response_time)
        self.total_requests += 1
        
        if is_error:
            self.error_count += 1
        
        # Keep only last 1000 response times
        if len(self.response_times) > 1000:
            self.response_times = self.response_times[-1000:]
    
    def record_cache_hit(self, is_hit: bool):
        """Record cache hit/miss"""
        if is_hit:
            self.cache_hits += 1
        else:
            self.cache_misses += 1
    
    async def save_metrics(self, metrics: PerformanceMetrics):
        """Save metrics to file"""
        self.metrics_history.append(metrics)
        
        # Keep only last 24 hours of metrics
        cutoff_time = datetime.now() - timedelta(hours=24)
        self.metrics_history = [
            m for m in self.metrics_history 
            if m.timestamp > cutoff_time
        ]
        
        # Save to file
        try:
            with open(self.metrics_file, 'w') as f:
                json.dump(
                    [asdict(m) for m in self.metrics_history],
                    f,
                    default=str,
                    indent=2
                )
        except Exception as e:
            logging.error(f"Failed to save metrics: {e}")
    
    async def start_monitoring(self, interval: int = 60):
        """Start continuous monitoring"""
        while True:
            try:
                metrics = await self.collect_system_metrics()
                await self.save_metrics(metrics)
                
                # Log alerts for high resource usage
                if metrics.cpu_percent > 80:
                    logging.warning(f"High CPU usage: {metrics.cpu_percent:.1f}%")
                
                if metrics.memory_percent > 80:
                    logging.warning(f"High memory usage: {metrics.memory_percent:.1f}%")
                
                if metrics.response_time_avg > 2000:  # 2 seconds
                    logging.warning(f"High response time: {metrics.response_time_avg:.0f}ms")
                
                if metrics.error_rate > 5:  # 5% error rate
                    logging.warning(f"High error rate: {metrics.error_rate:.1f}%")
                
            except Exception as e:
                logging.error(f"Monitoring error: {e}")
            
            await asyncio.sleep(interval)
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance summary"""
        if not self.metrics_history:
            return {"status": "No metrics available"}
        
        recent_metrics = self.metrics_history[-10:]  # Last 10 readings
        
        return {
            "current": asdict(self.metrics_history[-1]),
            "averages": {
                "cpu_percent": sum(m.cpu_percent for m in recent_metrics) / len(recent_metrics),
                "memory_percent": sum(m.memory_percent for m in recent_metrics) / len(recent_metrics),
                "response_time": sum(m.response_time_avg for m in recent_metrics) / len(recent_metrics),
                "error_rate": sum(m.error_rate for m in recent_metrics) / len(recent_metrics),
                "cache_hit_rate": sum(m.cache_hit_rate for m in recent_metrics) / len(recent_metrics)
            },
            "uptime_hours": (time.time() - self.start_time) / 3600,
            "total_requests": self.total_requests,
            "total_errors": self.error_count
        }

class WebVitalsMonitor:
    """Monitor Web Vitals and frontend performance"""
    
    def __init__(self):
        self.vitals_data: List[Dict[str, Any]] = []
    
    def record_web_vital(self, metric_name: str, value: float, rating: str):
        """Record a Web Vital metric"""
        self.vitals_data.append({
            'metric': metric_name,
            'value': value,
            'rating': rating,
            'timestamp': datetime.now().isoformat()
        })
        
        # Keep only last 1000 entries
        if len(self.vitals_data) > 1000:
            self.vitals_data = self.vitals_data[-1000:]
    
    def get_vitals_summary(self) -> Dict[str, Any]:
        """Get Web Vitals summary"""
        if not self.vitals_data:
            return {"status": "No vitals data available"}
        
        # Group by metric
        metrics = {}
        for entry in self.vitals_data:
            metric = entry['metric']
            if metric not in metrics:
                metrics[metric] = []
            metrics[metric].append(entry['value'])
        
        # Calculate averages and thresholds
        summary = {}
        for metric, values in metrics.items():
            avg_value = sum(values) / len(values)
            summary[metric] = {
                'average': avg_value,
                'latest': values[-1],
                'count': len(values),
                'status': self._get_metric_status(metric, avg_value)
            }
        
        return summary
    
    def _get_metric_status(self, metric: str, value: float) -> str:
        """Get status based on Web Vitals thresholds"""
        thresholds = {
            'CLS': {'good': 0.1, 'needs_improvement': 0.25},
            'FID': {'good': 100, 'needs_improvement': 300},
            'LCP': {'good': 2500, 'needs_improvement': 4000},
            'FCP': {'good': 1800, 'needs_improvement': 3000},
            'TTFB': {'good': 800, 'needs_improvement': 1800}
        }
        
        if metric not in thresholds:
            return 'unknown'
        
        threshold = thresholds[metric]
        if value <= threshold['good']:
            return 'good'
        elif value <= threshold['needs_improvement']:
            return 'needs_improvement'
        else:
            return 'poor'

class BundleAnalyzer:
    """Analyze frontend bundle performance"""
    
    def __init__(self, build_path: str = "frontend/build"):
        self.build_path = Path(build_path)
        self.analysis_results: Dict[str, Any] = {}
    
    def analyze_bundle_size(self) -> Dict[str, Any]:
        """Analyze bundle sizes and suggest optimizations"""
        if not self.build_path.exists():
            return {"error": "Build directory not found"}
        
        static_path = self.build_path / "static"
        results = {
            "js_files": [],
            "css_files": [],
            "total_size": 0,
            "recommendations": []
        }
        
        # Analyze JavaScript files
        if (static_path / "js").exists():
            for js_file in (static_path / "js").glob("*.js"):
                size = js_file.stat().st_size
                results["js_files"].append({
                    "name": js_file.name,
                    "size_kb": round(size / 1024, 2),
                    "size_mb": round(size / 1024 / 1024, 2)
                })
                results["total_size"] += size
        
        # Analyze CSS files
        if (static_path / "css").exists():
            for css_file in (static_path / "css").glob("*.css"):
                size = css_file.stat().st_size
                results["css_files"].append({
                    "name": css_file.name,
                    "size_kb": round(size / 1024, 2)
                })
                results["total_size"] += size
        
        results["total_size_mb"] = round(results["total_size"] / 1024 / 1024, 2)
        
        # Generate recommendations
        if results["total_size_mb"] > 2:
            results["recommendations"].append("Bundle size > 2MB. Consider code splitting.")
        
        large_js_files = [f for f in results["js_files"] if f["size_kb"] > 500]
        if large_js_files:
            results["recommendations"].append(f"Large JS files detected: {[f['name'] for f in large_js_files]}")
        
        return results
    
    def suggest_optimizations(self) -> List[str]:
        """Suggest bundle optimization strategies"""
        suggestions = [
            "Implement React.lazy() for route-based code splitting",
            "Use dynamic imports for heavy libraries",
            "Enable tree shaking in webpack configuration",
            "Compress images and use WebP format",
            "Implement service worker for caching",
            "Use CDN for static assets",
            "Minify and compress CSS/JS files",
            "Remove unused dependencies",
            "Use bundle analyzer to identify large modules",
            "Implement preloading for critical resources"
        ]
        return suggestions

# Global monitoring instances
performance_monitor = PerformanceMonitor("config/performance_metrics.json")
web_vitals_monitor = WebVitalsMonitor()
bundle_analyzer = BundleAnalyzer()
