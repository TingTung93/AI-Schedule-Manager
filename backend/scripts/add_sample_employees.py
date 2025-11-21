"""Add sample employee data for testing."""
import asyncio
from datetime import date
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models import Employee, Department
from src.core.security import security_manager
from src.core.config import settings


async def add_sample_employees():
    """Add sample employees to the database."""
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Get departments
        from sqlalchemy import select
        result = await session.execute(select(Department))
        departments = result.scalars().all()
        
        if not departments:
            print("No departments found. Please create departments first.")
            return
        
        dept_map = {dept.name: dept.id for dept in departments}
        
        # Sample employees
        sample_employees = [
            {
                "email": "john.doe@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "phone": "+1234567890",
                "department_id": dept_map.get("Sales", departments[0].id),
                "hire_date": date(2023, 1, 15),
                "position": "Sales Representative",
                "hourly_rate": 25.50,
                "max_hours_per_week": 40,
                "is_active": True,
            },
            {
                "email": "jane.smith@example.com",
                "first_name": "Jane",
                "last_name": "Smith",
                "phone": "+1234567891",
                "department_id": dept_map.get("Operations", departments[0].id),
                "hire_date": date(2022, 6, 1),
                "position": "Operations Manager",
                "hourly_rate": 35.00,
                "max_hours_per_week": 40,
                "is_active": True,
            },
            {
                "email": "bob.johnson@example.com",
                "first_name": "Bob",
                "last_name": "Johnson",
                "phone": "+1234567892",
                "department_id": dept_map.get("Support", departments[0].id),
                "hire_date": date(2023, 3, 10),
                "position": "Technical Support Specialist",
                "hourly_rate": 28.00,
                "max_hours_per_week": 40,
                "is_active": True,
            },
            {
                "email": "alice.williams@example.com",
                "first_name": "Alice",
                "last_name": "Williams",
                "phone": "+1234567893",
                "department_id": dept_map.get("Administration", departments[0].id),
                "hire_date": date(2021, 9, 1),
                "position": "HR Manager",
                "hourly_rate": 40.00,
                "max_hours_per_week": 40,
                "is_active": True,
            },
            {
                "email": "charlie.brown@example.com",
                "first_name": "Charlie",
                "last_name": "Brown",
                "phone": "+1234567894",
                "department_id": dept_map.get("Marketing", departments[0].id),
                "hire_date": date(2023, 7, 1),
                "position": "Marketing Coordinator",
                "hourly_rate": 30.00,
                "max_hours_per_week": 40,
                "is_active": True,
            },
        ]
        
        # Check if employees already exist
        for emp_data in sample_employees:
            result = await session.execute(
                select(Employee).where(Employee.email == emp_data["email"])
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"Employee {emp_data['email']} already exists, skipping...")
                continue
            
            # Create password hash
            emp_data["password_hash"] = security_manager.get_password_hash("Employee123!")
            
            employee = Employee(**emp_data)
            session.add(employee)
            print(f"Added employee: {emp_data['first_name']} {emp_data['last_name']}")
        
        await session.commit()
        print("\nSample employees added successfully!")


if __name__ == "__main__":
    asyncio.run(add_sample_employees())
