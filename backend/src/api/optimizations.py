from fastapi import FastAPI, Request, Response
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.compression import CompressionMiddleware
import time
import logging
from typing import Dict, Any, List
import asyncio
from datetime import datetime, timedelta

class APIOptimizations:
    def __init__(self, app: FastAPI):
        self.app = app
        self.request_cache: Dict[str, Any] = {}
        self.rate_limit_store: Dict[str, List[datetime]] = {}
        
    def setup_compression(self):
        """Setup response compression"""
        # Add GZip compression
        self.app.add_middleware(GZipMiddleware, minimum_size=1000)
        
        # Add Brotli compression for better compression ratio
        self.app.add_middleware(
            CompressionMiddleware,
            minimum_size=1000,
            compressor="brotli"
        )
    
    def setup_caching_headers(self):
        """Setup HTTP caching headers middleware"""
        @self.app.middleware("http")
        async def add_cache_headers(request: Request, call_next):
            response = await call_next(request)
            
            # Static assets caching
            if request.url.path.startswith(('/static/', '/assets/')):
                response.headers["Cache-Control"] = "public, max-age=31536000"  # 1 year
                response.headers["ETag"] = f'"{hash(request.url.path)}"'
            
            # API response caching
            elif request.method == "GET" and request.url.path.startswith('/api/'):
                if 'schedules' in request.url.path or 'employees' in request.url.path:
                    response.headers["Cache-Control"] = "public, max-age=300"  # 5 minutes
                else:
                    response.headers["Cache-Control"] = "public, max-age=60"   # 1 minute
            
            # Security headers
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            
            return response
    
    def setup_request_debouncing(self):
        """Setup request debouncing to prevent duplicate requests"""
        @self.app.middleware("http")
        async def debounce_requests(request: Request, call_next):
            # Only debounce POST/PUT/PATCH requests
            if request.method in ['POST', 'PUT', 'PATCH']:
                # Create request signature
                body = await request.body()
                request_sig = f"{request.method}:{request.url.path}:{hash(body)}"
                
                # Check if same request was made recently (within 2 seconds)
                now = datetime.now()
                if request_sig in self.request_cache:
                    last_request = self.request_cache[request_sig]
                    if (now - last_request).total_seconds() < 2:
                        return Response(
                            content="Duplicate request detected",
                            status_code=429,
                            headers={"Retry-After": "2"}
                        )
                
                self.request_cache[request_sig] = now
                
                # Clean old entries (older than 5 seconds)
                expired_keys = [
                    key for key, timestamp in self.request_cache.items()
                    if (now - timestamp).total_seconds() > 5
                ]
                for key in expired_keys:
                    del self.request_cache[key]
            
            return await call_next(request)
    
    def setup_request_batching(self):
        """Setup request batching for bulk operations"""
        @self.app.post("/api/batch")
        async def batch_requests(batch_data: Dict[str, Any]):
            """Handle multiple API requests in a single call"""
            requests = batch_data.get('requests', [])
            results = []
            
            # Process requests concurrently (limited concurrency)
            semaphore = asyncio.Semaphore(5)  # Max 5 concurrent requests
            
            async def process_request(req_data):
                async with semaphore:
                    method = req_data.get('method', 'GET')
                    path = req_data.get('path', '')
                    data = req_data.get('data', {})
                    
                    # Simulate API call processing
                    # In real implementation, this would route to appropriate handlers
                    return {
                        'id': req_data.get('id'),
                        'status': 200,
                        'data': f"Processed {method} {path}"
                    }
            
            tasks = [process_request(req) for req in requests]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            return {'results': results}
    
    def setup_performance_monitoring(self):
        """Setup API performance monitoring"""
        @self.app.middleware("http")
        async def monitor_performance(request: Request, call_next):
            start_time = time.time()
            
            response = await call_next(request)
            
            process_time = time.time() - start_time
            
            # Log slow requests
            if process_time > 1.0:
                logging.warning(
                    f"Slow API request: {request.method} {request.url.path} "
                    f"took {process_time:.2f}s"
                )
            
            # Add performance headers
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
    
    def setup_payload_optimization(self):
        """Setup payload size optimization"""
        @self.app.middleware("http")
        async def optimize_payload(request: Request, call_next):
            response = await call_next(request)
            
            # Add response size header for monitoring
            if hasattr(response, 'body'):
                body_size = len(response.body) if response.body else 0
                response.headers["X-Response-Size"] = str(body_size)
                
                # Warn about large responses
                if body_size > 1024 * 1024:  # 1MB
                    logging.warning(
                        f"Large response: {request.url.path} "
                        f"returned {body_size / 1024 / 1024:.2f}MB"
                    )
            
            return response
    
    def setup_all_optimizations(self):
        """Setup all API optimizations"""
        self.setup_compression()
        self.setup_caching_headers()
        self.setup_request_debouncing()
        self.setup_request_batching()
        self.setup_performance_monitoring()
        self.setup_payload_optimization()

class GraphQLOptimizations:
    """GraphQL setup for flexible queries"""
    
    def __init__(self):
        self.schema = self.create_schema()
    
    def create_schema(self):
        """Create GraphQL schema with optimizations"""
        # This would use a GraphQL library like Strawberry or Graphene
        # Simplified example structure:
        
        schema_definition = '''
        type Employee {
            id: ID!
            firstName: String!
            lastName: String!
            email: String!
            position: String
            department: Department
            schedules: [Schedule!]!
        }
        
        type Department {
            id: ID!
            name: String!
            employees: [Employee!]!
        }
        
        type Schedule {
            id: ID!
            employee: Employee!
            date: String!
            startTime: String!
            endTime: String!
            shift: String!
        }
        
        type Query {
            employees(limit: Int, offset: Int, department: String): [Employee!]!
            employee(id: ID!): Employee
            schedules(
                employeeId: ID,
                startDate: String,
                endDate: String,
                limit: Int,
                offset: Int
            ): [Schedule!]!
            departments: [Department!]!
        }
        
        type Mutation {
            createEmployee(input: EmployeeInput!): Employee!
            updateEmployee(id: ID!, input: EmployeeInput!): Employee!
            deleteEmployee(id: ID!): Boolean!
            
            createSchedule(input: ScheduleInput!): Schedule!
            updateSchedule(id: ID!, input: ScheduleInput!): Schedule!
            deleteSchedule(id: ID!): Boolean!
        }
        
        input EmployeeInput {
            firstName: String!
            lastName: String!
            email: String!
            position: String
            departmentId: ID
        }
        
        input ScheduleInput {
            employeeId: ID!
            date: String!
            startTime: String!
            endTime: String!
            shift: String!
        }
        '''
        
        return schema_definition
    
    def create_data_loaders(self):
        """Create DataLoaders to solve N+1 query problems"""
        # Example DataLoader implementation
        # This would batch database queries
        
        class EmployeeLoader:
            async def load_many(self, employee_ids):
                # Batch load employees by IDs
                # Return employees in same order as IDs
                pass
        
        class ScheduleLoader:
            async def load_by_employee(self, employee_ids):
                # Batch load schedules for multiple employees
                pass
        
        return {
            'employee_loader': EmployeeLoader(),
            'schedule_loader': ScheduleLoader()
        }

class ResponseOptimizer:
    """Optimize API responses"""
    
    @staticmethod
    def minimize_response(data: Dict[str, Any], fields: List[str] = None) -> Dict[str, Any]:
        """Return only requested fields to minimize payload"""
        if not fields:
            return data
        
        if isinstance(data, dict):
            return {key: data[key] for key in fields if key in data}
        elif isinstance(data, list):
            return [ResponseOptimizer.minimize_response(item, fields) for item in data]
        
        return data
    
    @staticmethod
    def paginate_response(data: List[Any], page: int, per_page: int) -> Dict[str, Any]:
        """Add pagination to response"""
        total = len(data)
        start = (page - 1) * per_page
        end = start + per_page
        
        return {
            'data': data[start:end],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page,
                'has_next': end < total,
                'has_prev': page > 1
            }
        }
    
    @staticmethod
    def compress_timestamps(data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert datetime objects to ISO strings for smaller payload"""
        def convert_datetime(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            elif isinstance(obj, dict):
                return {k: convert_datetime(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_datetime(item) for item in obj]
            return obj
        
        return convert_datetime(data)
