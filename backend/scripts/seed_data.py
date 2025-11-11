"""
Seed data script for development environment
"""

import asyncio
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path

# Add the parent directory to the path so we can import from src
sys.path.append(str(Path(__file__).parent.parent))

from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import AsyncSessionLocal, create_tables
from src.models import Employee, Shift, Schedule, ScheduleAssignment, Rule, Notification

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


async def create_sample_employees(session: AsyncSession) -> list[Employee]:
    """Create sample employees"""
    employees_data = [
        {
            "name": "John Manager",
            "email": "john.manager@company.com",
            "password_hash": hash_password("manager123"),
            "role": "manager",
            "is_admin": True,
            "qualifications": ["supervisor", "manager", "certified"],
            "availability": {
                "monday": {"available": True, "time_slots": [{"start": "08:00", "end": "18:00"}]},
                "tuesday": {"available": True, "time_slots": [{"start": "08:00", "end": "18:00"}]},
                "wednesday": {"available": True, "time_slots": [{"start": "08:00", "end": "18:00"}]},
                "thursday": {"available": True, "time_slots": [{"start": "08:00", "end": "18:00"}]},
                "friday": {"available": True, "time_slots": [{"start": "08:00", "end": "18:00"}]},
                "saturday": {"available": False},
                "sunday": {"available": False},
            },
        },
        {
            "name": "Alice Supervisor",
            "email": "alice.supervisor@company.com",
            "password_hash": hash_password("supervisor123"),
            "role": "supervisor",
            "qualifications": ["supervisor", "certified"],
            "availability": {
                "monday": {"available": True, "time_slots": [{"start": "06:00", "end": "20:00"}]},
                "tuesday": {"available": True, "time_slots": [{"start": "06:00", "end": "20:00"}]},
                "wednesday": {"available": True, "time_slots": [{"start": "06:00", "end": "20:00"}]},
                "thursday": {"available": True, "time_slots": [{"start": "06:00", "end": "20:00"}]},
                "friday": {"available": True, "time_slots": [{"start": "06:00", "end": "20:00"}]},
                "saturday": {"available": True, "time_slots": [{"start": "08:00", "end": "16:00"}]},
                "sunday": {"available": False},
            },
        },
        {
            "name": "Bob Worker",
            "email": "bob.worker@company.com",
            "password_hash": hash_password("worker123"),
            "role": "employee",
            "qualifications": ["general"],
            "availability": {
                "monday": {"available": True, "time_slots": [{"start": "09:00", "end": "17:00"}]},
                "tuesday": {"available": True, "time_slots": [{"start": "09:00", "end": "17:00"}]},
                "wednesday": {"available": True, "time_slots": [{"start": "09:00", "end": "17:00"}]},
                "thursday": {"available": True, "time_slots": [{"start": "09:00", "end": "17:00"}]},
                "friday": {"available": True, "time_slots": [{"start": "09:00", "end": "17:00"}]},
                "saturday": {"available": True, "time_slots": [{"start": "10:00", "end": "18:00"}]},
                "sunday": {"available": False},
            },
        },
        {
            "name": "Carol Specialist",
            "email": "carol.specialist@company.com",
            "password_hash": hash_password("specialist123"),
            "role": "employee",
            "qualifications": ["specialist", "certified", "advanced"],
            "availability": {
                "monday": {"available": True, "time_slots": [{"start": "10:00", "end": "19:00"}]},
                "tuesday": {"available": True, "time_slots": [{"start": "10:00", "end": "19:00"}]},
                "wednesday": {"available": True, "time_slots": [{"start": "10:00", "end": "19:00"}]},
                "thursday": {"available": True, "time_slots": [{"start": "10:00", "end": "19:00"}]},
                "friday": {"available": True, "time_slots": [{"start": "10:00", "end": "19:00"}]},
                "saturday": {"available": False},
                "sunday": {"available": True, "time_slots": [{"start": "12:00", "end": "20:00"}]},
            },
        },
        {
            "name": "David Night",
            "email": "david.night@company.com",
            "password_hash": hash_password("night123"),
            "role": "employee",
            "qualifications": ["general", "night_shift"],
            "availability": {
                "monday": {"available": True, "time_slots": [{"start": "22:00", "end": "06:00"}]},
                "tuesday": {"available": True, "time_slots": [{"start": "22:00", "end": "06:00"}]},
                "wednesday": {"available": True, "time_slots": [{"start": "22:00", "end": "06:00"}]},
                "thursday": {"available": True, "time_slots": [{"start": "22:00", "end": "06:00"}]},
                "friday": {"available": True, "time_slots": [{"start": "22:00", "end": "06:00"}]},
                "saturday": {"available": False},
                "sunday": {"available": False},
            },
        },
    ]

    employees = []
    for emp_data in employees_data:
        employee = Employee(**emp_data)
        session.add(employee)
        employees.append(employee)

    await session.flush()  # Get IDs
    return employees


async def create_sample_shifts(session: AsyncSession) -> list[Shift]:
    """Create sample shifts for the next week"""
    shifts = []
    today = date.today()

    # Create shifts for the next 7 days
    for day_offset in range(7):
        shift_date = today + timedelta(days=day_offset)

        # Morning shift
        morning_shift = Shift(
            date=shift_date,
            start_time=time(8, 0),
            end_time=time(16, 0),
            shift_type="general",
            required_staff=2,
            description="Morning shift - general operations",
            priority=3,
            requirements={"qualifications": ["general"]},
        )
        session.add(morning_shift)
        shifts.append(morning_shift)

        # Afternoon shift
        afternoon_shift = Shift(
            date=shift_date,
            start_time=time(16, 0),
            end_time=time(24, 0),
            shift_type="general",
            required_staff=2,
            description="Afternoon shift - general operations",
            priority=2,
            requirements={"qualifications": ["general"]},
        )
        session.add(afternoon_shift)
        shifts.append(afternoon_shift)

        # Night shift (weekdays only)
        if shift_date.weekday() < 5:  # Monday to Friday
            night_shift = Shift(
                date=shift_date + timedelta(days=1),  # Shift continues to next day
                start_time=time(0, 0),
                end_time=time(8, 0),
                shift_type="general",
                required_staff=1,
                description="Night shift - security and maintenance",
                priority=4,
                requirements={"qualifications": ["night_shift"]},
            )
            session.add(night_shift)
            shifts.append(night_shift)

        # Specialized shift (weekdays only)
        if shift_date.weekday() < 5:
            specialized_shift = Shift(
                date=shift_date,
                start_time=time(10, 0),
                end_time=time(19, 0),
                shift_type="specialized",
                required_staff=1,
                description="Specialized operations requiring advanced qualifications",
                priority=5,
                requirements={"qualifications": ["specialist", "certified"]},
            )
            session.add(specialized_shift)
            shifts.append(specialized_shift)

    await session.flush()
    return shifts


async def create_sample_schedule(session: AsyncSession, creator_id: int, shifts: list[Shift]) -> Schedule:
    """Create a sample schedule"""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # Monday of this week
    week_end = week_start + timedelta(days=6)  # Sunday of this week

    schedule = Schedule(
        week_start=week_start,
        week_end=week_end,
        status="published",
        title=f"Weekly Schedule - {week_start.strftime('%B %d')} to {week_end.strftime('%B %d, %Y')}",
        description="Standard weekly schedule with morning, afternoon, and specialized shifts",
        created_by=creator_id,
        published_at=datetime.utcnow(),
    )

    session.add(schedule)
    await session.flush()
    return schedule


async def create_sample_assignments(
    session: AsyncSession, schedule: Schedule, employees: list[Employee], shifts: list[Shift]
) -> list[ScheduleAssignment]:
    """Create sample schedule assignments"""
    assignments = []

    # Simple assignment logic - assign employees to shifts based on qualifications
    manager = next(e for e in employees if e.role == "manager")
    supervisor = next(e for e in employees if e.role == "supervisor")
    workers = [e for e in employees if e.role == "employee"]

    for shift in shifts[:10]:  # Assign first 10 shifts as examples
        if shift.shift_type == "specialized":
            # Assign specialist to specialized shifts
            specialist = next((e for e in workers if "specialist" in (e.qualifications or [])), None)
            if specialist:
                assignment = ScheduleAssignment(
                    schedule_id=schedule.id,
                    employee_id=specialist.id,
                    shift_id=shift.id,
                    status="confirmed",
                    priority=5,
                    auto_assigned=True,
                    assigned_by=manager.id,
                )
                session.add(assignment)
                assignments.append(assignment)

        elif shift.shift_type == "general":
            # Assign general workers to general shifts
            available_workers = [
                w for w in workers if w not in [a.employee for a in assignments if a.shift.date == shift.date]
            ]
            if available_workers:
                for i in range(min(shift.required_staff, len(available_workers))):
                    worker = available_workers[i]
                    assignment = ScheduleAssignment(
                        schedule_id=schedule.id,
                        employee_id=worker.id,
                        shift_id=shift.id,
                        status="assigned" if i == 0 else "confirmed",
                        priority=3,
                        auto_assigned=True,
                        assigned_by=supervisor.id,
                    )
                    session.add(assignment)
                    assignments.append(assignment)

    await session.flush()
    return assignments


async def create_sample_rules(session: AsyncSession, employees: list[Employee]) -> list[Rule]:
    """Create sample scheduling rules"""
    rules = []

    # Global rules (apply to all employees)
    global_rules = [
        {
            "rule_text": "No employee should work more than 40 hours per week",
            "rule_type": "workload",
            "employee_id": None,
            "constraints": {"max_weekly_hours": 40, "overtime_threshold": 40},
            "priority": 8,
            "strict": True,
            "description": "Legal limit on weekly working hours",
        },
        {
            "rule_text": "Minimum 8 hours rest between shifts",
            "rule_type": "rest_period",
            "employee_id": None,
            "constraints": {"min_rest_hours": 8},
            "priority": 9,
            "strict": True,
            "description": "Mandatory rest period between consecutive shifts",
        },
        {
            "rule_text": "Maximum 5 consecutive working days",
            "rule_type": "consecutive_days",
            "employee_id": None,
            "constraints": {"max_consecutive_days": 5},
            "priority": 7,
            "strict": True,
            "description": "Prevent employee burnout with mandatory days off",
        },
        {
            "rule_text": "Maximum 12 hours overtime per week",
            "rule_type": "overtime",
            "employee_id": None,
            "constraints": {"max_weekly_overtime": 12, "standard_weekly_hours": 40},
            "priority": 6,
            "strict": False,
            "description": "Limit overtime to prevent fatigue",
        },
    ]

    for rule_data in global_rules:
        rule = Rule(**rule_data)
        session.add(rule)
        rules.append(rule)

    # Employee-specific rules
    night_worker = next((e for e in employees if "night_shift" in (e.qualifications or [])), None)
    if night_worker:
        night_rule = Rule(
            rule_text=f"{night_worker.name} prefers night shifts",
            rule_type="preference",
            employee_id=night_worker.id,
            constraints={"preferred_shift_types": ["general"], "preferred_times": ["22:00-06:00"]},
            priority=4,
            strict=False,
            description="Employee preference for night shifts",
        )
        session.add(night_rule)
        rules.append(night_rule)

    # Qualification rule for specialized shifts
    specialist = next((e for e in employees if "specialist" in (e.qualifications or [])), None)
    if specialist:
        specialist_rule = Rule(
            rule_text="Specialized shifts require certified specialists",
            rule_type="qualification",
            employee_id=None,
            constraints={"required_qualifications": ["specialist", "certified"], "shift_types": ["specialized"]},
            priority=10,
            strict=True,
            description="Quality assurance for specialized operations",
        )
        session.add(specialist_rule)
        rules.append(specialist_rule)

    await session.flush()
    return rules


async def create_sample_notifications(session: AsyncSession, employees: list[Employee]) -> list[Notification]:
    """Create sample notifications"""
    notifications = []

    # Create various types of notifications for employees
    for employee in employees[:3]:  # First 3 employees get notifications
        # Welcome notification
        welcome_notif = Notification.create_system_alert(
            user_id=employee.id,
            alert_message=f"Welcome to the AI Schedule Manager, {employee.name}! Your account has been set up successfully.",
            priority="normal",
            category="welcome",
        )
        session.add(welcome_notif)
        notifications.append(welcome_notif)

        # Schedule notification
        schedule_notif = Notification.create_schedule_notification(
            user_id=employee.id,
            schedule_id=1,  # Assuming first schedule
            notification_type="schedule_update",
            title="New Schedule Published",
            message="Your schedule for next week has been published. Please review your assignments.",
            priority="high",
        )
        session.add(schedule_notif)
        notifications.append(schedule_notif)

    # Manager gets approval notification
    manager = next((e for e in employees if e.role == "manager"), None)
    if manager:
        approval_notif = Notification.create_approval_notification(user_id=manager.id, schedule_id=1, action_required="review")
        session.add(approval_notif)
        notifications.append(approval_notif)

    await session.flush()
    return notifications


async def main():
    """Main seeding function"""
    print("🌱 Starting database seeding...")

    # Ensure tables exist
    await create_tables()
    print("✅ Database tables created/verified")

    async with AsyncSessionLocal() as session:
        try:
            # Create sample data
            print("👥 Creating sample employees...")
            employees = await create_sample_employees(session)

            print("⏰ Creating sample shifts...")
            shifts = await create_sample_shifts(session)

            print("📅 Creating sample schedule...")
            schedule = await create_sample_schedule(session, employees[0].id, shifts)

            print("📋 Creating sample assignments...")
            assignments = await create_sample_assignments(session, schedule, employees, shifts)

            print("📏 Creating sample rules...")
            rules = await create_sample_rules(session, employees)

            print("🔔 Creating sample notifications...")
            notifications = await create_sample_notifications(session, employees)

            # Commit all changes
            await session.commit()

            print(
                f"""
✅ Database seeding completed successfully!

📊 Created:
   • {len(employees)} employees
   • {len(shifts)} shifts
   • 1 schedule
   • {len(assignments)} assignments
   • {len(rules)} rules
   • {len(notifications)} notifications

🔑 Test Login Credentials:
   Manager: john.manager@company.com / manager123
   Supervisor: alice.supervisor@company.com / supervisor123
   Worker: bob.worker@company.com / worker123
   Specialist: carol.specialist@company.com / specialist123
   Night Worker: david.night@company.com / night123
            """
            )

        except Exception as e:
            await session.rollback()
            print(f"❌ Error during seeding: {e}")
            raise

        finally:
            await session.close()


if __name__ == "__main__":
    asyncio.run(main())
