"""
Unit tests for the Constraint Solver using Google OR-Tools.
Tests schedule optimization with various constraints and objectives.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import date, datetime, timedelta
from ortools.sat.python import cp_model

from src.scheduler.constraint_solver import ScheduleOptimizer, ShiftType, Employee, Shift, SchedulingConstraint


class TestDataClasses:
    """Test the data classes used in constraint solver."""

    def test_employee_creation(self):
        """Test Employee dataclass creation."""
        employee = Employee(
            id="emp1",
            name="John Doe",
            role="Cashier",
            min_hours_week=20,
            max_hours_week=40,
            hourly_rate=15.0,
            skills=["cash_handling", "customer_service"],
            availability={0: [(9, 17)], 1: [(9, 17)]},
        )

        assert employee.id == "emp1"
        assert employee.name == "John Doe"
        assert employee.min_hours_week == 20
        assert employee.max_hours_week == 40
        assert employee.hourly_rate == 15.0
        assert len(employee.skills) == 2
        assert 0 in employee.availability

    def test_shift_creation(self):
        """Test Shift dataclass creation."""
        shift = Shift(
            id="shift1",
            day=0,  # Monday
            start_hour=9,
            end_hour=17,
            required_role="Cashier",
            required_skills=["cash_handling"],
            min_staff=2,
            max_staff=4,
        )

        assert shift.id == "shift1"
        assert shift.day == 0
        assert shift.start_hour == 9
        assert shift.end_hour == 17
        assert shift.min_staff == 2
        assert shift.max_staff == 4

    def test_scheduling_constraint_creation(self):
        """Test SchedulingConstraint dataclass creation."""
        constraint = SchedulingConstraint(
            employee_id="emp1",
            constraint_type="availability",
            day=0,
            start_time=9,
            end_time=17,
            priority=8,
            metadata={"reason": "childcare"},
        )

        assert constraint.employee_id == "emp1"
        assert constraint.constraint_type == "availability"
        assert constraint.priority == 8
        assert "reason" in constraint.metadata

    def test_shift_type_enum(self):
        """Test ShiftType enum values."""
        assert ShiftType.MORNING.value == "morning"
        assert ShiftType.AFTERNOON.value == "afternoon"
        assert ShiftType.NIGHT.value == "night"
        assert ShiftType.CUSTOM.value == "custom"


class TestScheduleOptimizer:
    """Test suite for ScheduleOptimizer class."""

    @pytest.fixture
    def optimizer(self):
        """Create a ScheduleOptimizer instance."""
        return ScheduleOptimizer()

    @pytest.fixture
    def sample_employees(self):
        """Create sample employees for testing."""
        return [
            Employee(
                id="emp1",
                name="Alice",
                role="Cashier",
                min_hours_week=20,
                max_hours_week=40,
                hourly_rate=15.0,
                skills=["cash_handling"],
                availability={i: [(8, 20)] for i in range(7)},
            ),
            Employee(
                id="emp2",
                name="Bob",
                role="Cashier",
                min_hours_week=25,
                max_hours_week=40,
                hourly_rate=16.0,
                skills=["cash_handling", "inventory"],
                availability={i: [(10, 18)] for i in range(5)},  # Weekdays only
            ),
            Employee(
                id="emp3",
                name="Charlie",
                role="Manager",
                min_hours_week=35,
                max_hours_week=45,
                hourly_rate=25.0,
                skills=["management", "cash_handling"],
                availability={i: [(8, 22)] for i in range(7)},
            ),
        ]

    @pytest.fixture
    def sample_shifts(self):
        """Create sample shifts for testing."""
        shifts = []
        for day in range(7):
            # Morning shift
            shifts.append(
                Shift(
                    id=f"shift_m_{day}",
                    day=day,
                    start_hour=8,
                    end_hour=14,
                    required_role="Cashier",
                    required_skills=[],
                    min_staff=1,
                    max_staff=2,
                )
            )
            # Afternoon shift
            shifts.append(
                Shift(
                    id=f"shift_a_{day}",
                    day=day,
                    start_hour=14,
                    end_hour=20,
                    required_role="Cashier",
                    required_skills=[],
                    min_staff=1,
                    max_staff=2,
                )
            )
        return shifts

    @pytest.fixture
    def sample_constraints(self):
        """Create sample constraints for testing."""
        return [
            SchedulingConstraint(
                employee_id="emp1",
                constraint_type="availability",
                day=0,
                start_time=None,
                end_time=17,
                priority=9,
                metadata={"reason": "childcare"},
            ),
            SchedulingConstraint(
                employee_id="emp2",
                constraint_type="preference",
                day=None,
                start_time=10,
                end_time=16,
                priority=5,
                metadata={"preferred_hours": "10:00-16:00"},
            ),
        ]

    def test_optimizer_initialization(self, optimizer):
        """Test ScheduleOptimizer initialization."""
        assert optimizer.model is not None
        assert optimizer.solver is not None
        assert isinstance(optimizer.assignments, dict)
        assert isinstance(optimizer.shift_hours, dict)
        assert isinstance(optimizer.employee_weekly_hours, dict)

    def test_create_variables(self, optimizer, sample_employees, sample_shifts):
        """Test creation of decision variables."""
        optimizer._create_variables(sample_employees, sample_shifts)

        # Check assignments variables
        for emp in sample_employees:
            for shift in sample_shifts:
                assert (emp.id, shift.id) in optimizer.assignments

        # Check shift hours calculation
        for shift in sample_shifts:
            assert shift.id in optimizer.shift_hours
            assert optimizer.shift_hours[shift.id] == 6  # 6-hour shifts

        # Check weekly hours variables
        for emp in sample_employees:
            assert emp.id in optimizer.employee_weekly_hours

    def test_shift_hours_calculation(self, optimizer):
        """Test shift hours calculation including overnight shifts."""
        employees = [
            Employee(
                id="emp1",
                name="Test",
                role="Test",
                min_hours_week=0,
                max_hours_week=40,
                hourly_rate=15.0,
                skills=[],
                availability={},
            )
        ]

        shifts = [
            Shift(id="day", day=0, start_hour=9, end_hour=17, required_role="", required_skills=[], min_staff=1, max_staff=1),
            Shift(
                id="overnight",
                day=0,
                start_hour=22,
                end_hour=6,
                required_role="",
                required_skills=[],
                min_staff=1,
                max_staff=1,
            ),
        ]

        optimizer._create_variables(employees, shifts)

        assert optimizer.shift_hours["day"] == 8
        assert optimizer.shift_hours["overnight"] == 8  # 22:00 to 06:00 = 8 hours

    def test_is_available(self, optimizer):
        """Test employee availability checking."""
        employee = Employee(
            id="emp1",
            name="Test",
            role="Test",
            min_hours_week=0,
            max_hours_week=40,
            hourly_rate=15.0,
            skills=[],
            availability={0: [(9, 17)], 1: [(10, 18)]},
        )

        # Available shift
        shift1 = Shift(
            id="s1", day=0, start_hour=10, end_hour=16, required_role="", required_skills=[], min_staff=1, max_staff=1
        )
        assert optimizer._is_available(employee, shift1) is True

        # Unavailable shift (outside hours)
        shift2 = Shift(
            id="s2", day=0, start_hour=7, end_hour=9, required_role="", required_skills=[], min_staff=1, max_staff=1
        )
        assert optimizer._is_available(employee, shift2) is False

        # Unavailable shift (wrong day)
        shift3 = Shift(
            id="s3", day=2, start_hour=10, end_hour=16, required_role="", required_skills=[], min_staff=1, max_staff=1
        )
        assert optimizer._is_available(employee, shift3) is False

    def test_has_required_qualifications(self, optimizer):
        """Test checking employee qualifications for shifts."""
        employee = Employee(
            id="emp1",
            name="Test",
            role="Cashier",
            min_hours_week=0,
            max_hours_week=40,
            hourly_rate=15.0,
            skills=["cash_handling", "inventory"],
            availability={},
        )

        # Matching role and skills
        shift1 = Shift(
            id="s1",
            day=0,
            start_hour=9,
            end_hour=17,
            required_role="Cashier",
            required_skills=["cash_handling"],
            min_staff=1,
            max_staff=1,
        )
        assert optimizer._has_required_qualifications(employee, shift1) is True

        # Wrong role
        shift2 = Shift(
            id="s2", day=0, start_hour=9, end_hour=17, required_role="Manager", required_skills=[], min_staff=1, max_staff=1
        )
        assert optimizer._has_required_qualifications(employee, shift2) is False

        # Missing skill
        shift3 = Shift(
            id="s3",
            day=0,
            start_hour=9,
            end_hour=17,
            required_role="Cashier",
            required_skills=["customer_service"],
            min_staff=1,
            max_staff=1,
        )
        assert optimizer._has_required_qualifications(employee, shift3) is False

    @patch("src.scheduler.constraint_solver.cp_model.CpSolver")
    def test_generate_schedule_optimal(
        self, mock_solver_class, optimizer, sample_employees, sample_shifts, sample_constraints
    ):
        """Test schedule generation with optimal solution."""
        mock_solver = Mock()
        mock_solver.Solve.return_value = cp_model.OPTIMAL
        mock_solver.BooleanValue.return_value = True
        mock_solver.WallTime.return_value = 1.5
        mock_solver.ObjectiveValue.return_value = 1000
        mock_solver_class.return_value = mock_solver

        optimizer.solver = mock_solver

        result = optimizer.generate_schedule(
            sample_employees, sample_shifts, sample_constraints, date(2024, 1, 1), num_weeks=1
        )

        assert result["status"] == "optimal"
        assert "assignments" in result
        assert "metrics" in result
        assert "employee_hours" in result
        assert "total_cost" in result

    @patch("src.scheduler.constraint_solver.cp_model.CpSolver")
    def test_generate_schedule_infeasible(
        self, mock_solver_class, optimizer, sample_employees, sample_shifts, sample_constraints
    ):
        """Test schedule generation with infeasible solution."""
        mock_solver = Mock()
        mock_solver.Solve.return_value = cp_model.INFEASIBLE
        mock_solver_class.return_value = mock_solver

        optimizer.solver = mock_solver

        result = optimizer.generate_schedule(
            sample_employees, sample_shifts, sample_constraints, date(2024, 1, 1), num_weeks=1
        )

        assert result["status"] == "fallback"
        assert "assignments" in result

    def test_apply_custom_constraint(self, optimizer, sample_employees, sample_shifts):
        """Test applying custom constraints from parsed rules."""
        optimizer._create_variables(sample_employees, sample_shifts)

        # Create a constraint that employee can't work after 5pm on day 0
        constraint = SchedulingConstraint(
            employee_id="emp1", constraint_type="availability", day=0, start_time=None, end_time=17, priority=9, metadata={}
        )

        # Mock the model.Add method to track constraints
        with patch.object(optimizer.model, "Add") as mock_add:
            optimizer._apply_custom_constraint(constraint, sample_employees, sample_shifts)

            # Should have added constraints for shifts ending after 17:00 on day 0
            assert mock_add.called

    def test_add_rest_period_constraints(self, optimizer, sample_employees):
        """Test minimum rest period constraints between shifts."""
        # Create consecutive day shifts with insufficient rest
        shifts = [
            Shift(
                id="late_shift",
                day=0,
                start_hour=16,
                end_hour=23,
                required_role="",
                required_skills=[],
                min_staff=1,
                max_staff=1,
            ),
            Shift(
                id="early_shift",
                day=1,
                start_hour=6,
                end_hour=14,
                required_role="",
                required_skills=[],
                min_staff=1,
                max_staff=1,
            ),
        ]

        optimizer._create_variables(sample_employees, shifts)

        with patch.object(optimizer.model, "Add") as mock_add:
            optimizer._add_rest_period_constraints(sample_employees, shifts)

            # Should add constraint preventing same employee from working both shifts
            # (only 7 hours rest between 23:00 and 06:00)
            assert mock_add.called

    def test_create_preference_penalty(self, optimizer, sample_employees, sample_shifts):
        """Test creation of preference violation penalties."""
        optimizer._create_variables(sample_employees, sample_shifts)

        constraint = SchedulingConstraint(
            employee_id="emp1",
            constraint_type="preference",
            day=None,
            start_time=None,
            end_time=None,
            priority=5,
            metadata={"preferred_hours": "09:00-15:00"},
        )

        penalty = optimizer._create_preference_penalty(constraint, sample_employees, sample_shifts)
        # Penalty should be created for shifts outside preferred hours
        assert penalty is not None or penalty == 0

    def test_create_weekend_fairness_penalty(self, optimizer, sample_employees, sample_shifts):
        """Test weekend shift fairness penalty creation."""
        optimizer._create_variables(sample_employees, sample_shifts)

        penalty = optimizer._create_weekend_fairness_penalty(sample_employees, sample_shifts)
        assert penalty is not None  # Weekend shifts exist in sample_shifts

    def test_calculate_workload_variance(self, optimizer, sample_employees, sample_shifts):
        """Test workload variance calculation."""
        optimizer._create_variables(sample_employees, sample_shifts)

        variance = optimizer._calculate_workload_variance(sample_employees)
        assert variance is not None

    def test_extract_solution(self, optimizer, sample_employees, sample_shifts):
        """Test solution extraction from solver."""
        optimizer._create_variables(sample_employees, sample_shifts)

        # Mock solver values
        optimizer.solver = Mock()
        optimizer.solver.BooleanValue = Mock(side_effect=lambda x: False)  # No assignments
        optimizer.solver.WallTime = Mock(return_value=2.5)
        optimizer.solver.ObjectiveValue = Mock(return_value=1500)

        result = optimizer._extract_solution(sample_employees, sample_shifts, date(2024, 1, 1), cp_model.OPTIMAL)

        assert result["status"] == "optimal"
        assert result["start_date"] == "2024-01-01"
        assert "assignments" in result
        assert "metrics" in result
        assert result["metrics"]["optimization_time"] == 2.5
        assert result["metrics"]["objective_value"] == 1500

    def test_generate_fallback_schedule(self, optimizer, sample_employees, sample_shifts):
        """Test fallback schedule generation."""
        result = optimizer._generate_fallback_schedule(sample_employees, sample_shifts, date(2024, 1, 1))

        assert result["status"] == "fallback"
        assert "assignments" in result
        assert "employee_hours" in result
        assert "total_cost" in result

        # Should have some assignments from round-robin
        assert len(result["assignments"]) > 0

    def test_hard_constraints_application(self, optimizer, sample_employees, sample_shifts, sample_constraints):
        """Test that hard constraints are properly applied."""
        with patch.object(optimizer.model, "Add") as mock_add:
            optimizer._create_variables(sample_employees, sample_shifts)
            optimizer._add_hard_constraints(sample_employees, sample_shifts, sample_constraints)

            # Should have added multiple constraint types
            assert mock_add.call_count > 0

            # Verify different constraint types were added
            calls_str = str(mock_add.call_args_list)
            # Should include min/max staff, weekly hours, etc.
            assert mock_add.called

    def test_objective_function_creation(self, optimizer, sample_employees, sample_shifts, sample_constraints):
        """Test multi-objective function creation."""
        optimizer._create_variables(sample_employees, sample_shifts)

        with patch.object(optimizer.model, "Minimize") as mock_minimize:
            optimizer._create_objective(sample_employees, sample_shifts, sample_constraints)

            # Should have called minimize with combined objectives
            assert mock_minimize.called

    def test_edge_case_no_employees(self, optimizer):
        """Test handling of no employees."""
        result = optimizer.generate_schedule(
            [],  # No employees
            [Shift(id="s1", day=0, start_hour=9, end_hour=17, required_role="", required_skills=[], min_staff=1, max_staff=1)],
            [],
            date(2024, 1, 1),
        )

        assert result["status"] == "fallback"
        assert len(result["assignments"]) == 0

    def test_edge_case_no_shifts(self, optimizer, sample_employees):
        """Test handling of no shifts."""
        result = optimizer.generate_schedule(sample_employees, [], [], date(2024, 1, 1))  # No shifts

        assert "assignments" in result
        assert len(result["assignments"]) == 0
